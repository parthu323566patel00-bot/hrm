"""
app/api/v1/endpoints/users.py
------------------------------
User-facing endpoints: current-user profile, staff invitation generation,
and doctor department self-assignment.

`get_current_user` is imported from the shared `app.api.deps` module so that
other routers do not need to import from this file.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user          # ← shared dependency
from app.core.auth_utils import has_permission
from app.core.database import get_db
from app.models.department import Department
from app.models.invitation import Invitation
from app.models.role import Role
from app.models.user import User
from app.models.doctor_department import DoctorDepartment
from app.schemas.invitation import InvitationCreate
from app.schemas.user import UserOut, UserUpdate

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /users/me
# ---------------------------------------------------------------------------
@router.get("/me", response_model=UserOut)
async def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return the profile of the currently authenticated user."""
    return current_user


# ---------------------------------------------------------------------------
# POST /users/invite
# ---------------------------------------------------------------------------
@router.post("/invite")
async def create_user_invite(
    invite_in: InvitationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Generate a secure invitation link for a new staff member.
    Requires the ``user:create`` permission.
    Department assignment is NOT part of the invitation — doctors select
    their own departments after registration.
    """
    # 1. Permission gate
    if not await has_permission(db, current_user, "user:create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to invite users.",
        )

    # 2. Validate role exists and belongs to the same tenant
    role_res = await db.execute(select(Role).filter(Role.id == invite_in.role_id))
    role_obj = role_res.scalars().first()
    if not role_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Designated role not found.",
        )
    if not current_user.is_superuser and role_obj.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot assign a role belonging to another hospital.",
        )

    # 3. Create invitation record (no department — doctor picks it themselves)
    token_str = uuid.uuid4().hex
    expiry = datetime.now(timezone.utc) + timedelta(days=2)

    invitation = Invitation(
        tenant_id=current_user.tenant_id,
        email=invite_in.email,
        role_id=invite_in.role_id,
        token=token_str,
        expires_at=expiry,
        is_used=False,
    )
    db.add(invitation)
    try:
        await db.commit()
        await db.refresh(invitation)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record invitation: {str(exc)}",
        )

    # 4. Build frontend link and return
    invite_link = f"http://localhost:5173/?token={token_str}"
    return {
        "email": invitation.email,
        "role_id": invitation.role_id,
        "role_name": role_obj.name,
        "invite_link": invite_link,
        "expires_at": invitation.expires_at,
    }


# ---------------------------------------------------------------------------
# PUT /users/me
# ---------------------------------------------------------------------------
@router.put("/me", response_model=UserOut)
async def update_user_me(
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update the current user's profile details.
    Allows changing full_name, email, and password.
    """
    update_data = user_update.model_dump(exclude_unset=True)

    # 1. Process email uniqueness if email is changed
    if "email" in update_data and update_data["email"] != current_user.email:
        existing_email = await db.execute(
            select(User).filter(User.email == update_data["email"])
        )
        if existing_email.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use."
            )

    # 2. Process password if provided (handles RSA decryption if needed)
    if "password" in update_data and update_data["password"]:
        from app.core.crypto import decrypt_password
        from app.core.security import get_password_hash
        try:
            decrypted = decrypt_password(update_data["password"])
            current_user.hashed_password = get_password_hash(decrypted)
        except Exception:
            current_user.hashed_password = get_password_hash(update_data["password"])
        del update_data["password"]

    # 3. Apply updates
    for field, val in update_data.items():
        setattr(current_user, field, val)

    db.add(current_user)
    try:
        await db.commit()
        await db.refresh(current_user)
        return current_user
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user profile: {str(exc)}"
        )


# ---------------------------------------------------------------------------
# PUT /users/me/departments  (Doctor only)
# ---------------------------------------------------------------------------
@router.put("/me/departments")
async def update_my_departments(
    department_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Replace the current doctor's department memberships.
    Accepts a list of department IDs. Only available to users with role Doctor (id=4).
    """
    # Doctor-only guard (role_id 4)
    if current_user.role_id != 4:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can manage department memberships.",
        )

    # 1. Validate all provided department IDs belong to the user's tenant
    if department_ids:
        dept_res = await db.execute(
            select(Department).filter(
                Department.id.in_(department_ids),
                Department.tenant_id == current_user.tenant_id,
                Department.is_active == True,  # noqa: E712
            )
        )
        found_depts = dept_res.scalars().all()
        if len(found_depts) != len(department_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more department IDs are invalid or do not belong to your hospital.",
            )

    # 2. Remove existing doctor-department memberships
    existing_res = await db.execute(
        select(DoctorDepartment).filter(DoctorDepartment.doctor_id == current_user.id)
    )
    for row in existing_res.scalars().all():
        await db.delete(row)

    # 3. Insert new memberships
    for dept_id in department_ids:
        db.add(DoctorDepartment(doctor_id=current_user.id, department_id=dept_id))

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update department memberships: {str(exc)}",
        )

    # 4. Return updated list
    await db.refresh(current_user)
    return {
        "message": "Department memberships updated.",
        "departments": [
            {"id": d.id, "name": d.name, "code": d.code}
            for d in current_user.departments
        ],
    }


# ---------------------------------------------------------------------------
# GET /users/me/departments  (Doctor only)
# ---------------------------------------------------------------------------
@router.get("/me/departments")
async def get_my_departments(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return the current doctor's department memberships."""
    if current_user.role_id != 4:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors have department memberships.",
        )
    return [
        {"id": d.id, "name": d.name, "code": d.code}
        for d in current_user.departments
    ]
