from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user import get_user_by_email, create_user
from app.schemas.user import UserCreate, UserOut, Token
from app.core.database import get_db
from app.core import security
from app.core.config import settings
from app.core.crypto import get_public_key_pem, decrypt_password

router = APIRouter()

@router.get("/public-key")
async def get_public_key(response: Response) -> Any:
    """
    Get the RSA public key for password encryption.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    try:
        pem = get_public_key_pem()
        return {"public_key": pem}
    except Exception as e:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve public key: {str(e)}",
        )

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)) -> Any:
    """
    Register a new user. The incoming password is RSA-encrypted and base64-encoded.
    """
    # 1. Decrypt password
    try:
        decrypted_password = decrypt_password(user_in.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid encrypted password payload: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Decryption failed: {str(e)}",
        )

    # 2. Check and Register User
    try:
        user = await get_user_by_email(db, email=user_in.email)
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The user with this email already exists in the system.",
            )
        
        # Override password with decrypted cleartext to be hashed in crud
        user_in.password = decrypted_password
        new_user = await create_user(db, user_in=user_in)
        return new_user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during registration: {str(e)}",
        )

@router.post("/login", response_model=Token)
async def login(
    db: AsyncSession = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login. The password is RSA-encrypted and base64-encoded.
    """
    # 1. Decrypt password
    try:
        decrypted_password = decrypt_password(form_data.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid encrypted password payload: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Decryption failed: {str(e)}",
        )

    # 2. Authenticate
    try:
        user = await get_user_by_email(db, email=form_data.username)
        if not user or not security.verify_password(decrypted_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect email or password.",
            )
        elif not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user.",
            )
        
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return {
            "access_token": security.create_access_token(
                user.id, expires_delta=access_token_expires
            ),
            "token_type": "bearer",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during login: {str(e)}",
        )

from datetime import datetime, timezone
from sqlalchemy.future import select
from app.models.invitation import Invitation
from app.models.role import Role
from app.schemas.invitation import InvitationRegister

@router.get("/invite/validate")
async def validate_invitation(token: str, db: AsyncSession = Depends(get_db)) -> Any:
    """
    Validate an invitation token and return metadata.
    """
    result = await db.execute(select(Invitation).filter(Invitation.token == token))
    invitation = result.scalars().first()
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or invalid."
        )
    if invitation.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has already been used."
        )
    if invitation.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has expired."
        )

    # Get role name
    role_res = await db.execute(select(Role).filter(Role.id == invitation.role_id))
    role_obj = role_res.scalars().first()
    role_name = role_obj.name if role_obj else "Staff"

    return {
        "email": invitation.email,
        "tenant_id": invitation.tenant_id,
        "role_id": invitation.role_id,
        "role_name": role_name
    }

@router.post("/invite/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_invited_user(
    reg_in: InvitationRegister,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Register an invited user by token. Decrypts the password using RSA and validates invitation.
    """
    # 1. Fetch and Validate Invitation
    result = await db.execute(select(Invitation).filter(Invitation.token == reg_in.token))
    invitation = result.scalars().first()
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found."
        )
    if invitation.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has already been used."
        )
    if invitation.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has expired."
        )

    # 2. Check if user already exists
    existing_user = await get_user_by_email(db, email=invitation.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address is already registered."
        )

    # 3. Decrypt password
    try:
        decrypted_password = decrypt_password(reg_in.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid encrypted password payload: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Decryption failed: {str(e)}",
        )

    # 4. Create User (department assignment happens separately via PUT /users/me/departments)
    try:
        user_in = UserCreate(
            email=invitation.email,
            tenant_id=invitation.tenant_id,
            role_id=invitation.role_id,
            password=decrypted_password,
            full_name=invitation.email.split("@")[0].capitalize(),
            is_active=True,
            is_superuser=False
        )
        new_user = await create_user(db, user_in=user_in)

        # Mark invitation as used
        invitation.is_used = True
        db.add(invitation)
        await db.commit()
        await db.refresh(new_user)
        return new_user
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during account creation: {str(e)}",
        )


