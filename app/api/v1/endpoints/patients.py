"""
app/api/v1/endpoints/patients.py
----------------------------------
Patient management endpoints: register, list/search, get by ID, update, archive.

Permissions enforced via RBAC (has_permission).
Tenant isolation enforced on every query.

Pagination: GET /patients/ returns { data, meta } in a single call —
no separate /count endpoint needed.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func as sql_func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.auth_utils import has_permission
from app.core.database import get_db
from app.models.patient import Patient
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientOut, PatientUpdate, PatientPageOut

router = APIRouter()

PAGE_SIZE_DEFAULT = 7
PAGE_SIZE_MAX     = 100


def _build_filter(query, *, tenant_id: str, q: Optional[str], include_archived: bool):
    """Apply shared WHERE conditions — reused by both data and count queries."""
    query = query.filter(Patient.tenant_id == tenant_id)
    if not include_archived:
        query = query.filter(Patient.is_archived == False)  # noqa: E712
    if q:
        expr = f"%{q}%"
        query = query.filter(
            or_(
                Patient.name.ilike(expr),
                Patient.phone.ilike(expr),
                Patient.email.ilike(expr),
            )
        )
    return query


# ---------------------------------------------------------------------------
# POST /patients/
# ---------------------------------------------------------------------------
@router.post("/", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_in: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PatientOut:
    """Register a new patient. Requires ``patient:create`` permission."""
    if not await has_permission(db, current_user, "patient:create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to register patients.",
        )

    patient = Patient(
        tenant_id=current_user.tenant_id,
        name=patient_in.name,
        age=patient_in.age,
        phone=patient_in.phone,
        gender=patient_in.gender,
        email=patient_in.email,
        blood_group=patient_in.blood_group,
        address=patient_in.address,
        allergies=patient_in.allergies,
        notes=patient_in.notes,
        is_archived=False,
    )
    db.add(patient)
    try:
        await db.commit()
        await db.refresh(patient)
        return patient
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register patient: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# GET /patients/  — paginated list with inline meta (single API call)
# ---------------------------------------------------------------------------
@router.get("/", response_model=PatientPageOut)
async def list_patients(
    q: Optional[str] = Query(None, description="Search by name, phone, or email"),
    include_archived: bool = Query(False),
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PatientPageOut:
    """
    Paginated patient list. Returns data + meta in a single call.
    """
    can_search = await has_permission(db, current_user, "patient:search")
    can_view   = await has_permission(db, current_user, "patient:view")
    if not (can_search or can_view):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to query patients.",
        )

    base_count = _build_filter(
        select(sql_func.count(Patient.id)),
        tenant_id=current_user.tenant_id, q=q,
        include_archived=include_archived,
    )
    base_data = _build_filter(
        select(Patient),
        tenant_id=current_user.tenant_id, q=q,
        include_archived=include_archived,
    )

    count_result = await db.execute(base_count)
    total: int = count_result.scalar() or 0

    skip = (page - 1) * page_size
    data_result = await db.execute(
        base_data.order_by(Patient.created_at.desc()).offset(skip).limit(page_size)
    )
    patients = data_result.scalars().all()

    total_pages = max(1, -(-total // page_size))  # ceiling division

    return PatientPageOut(
        data=[PatientOut.model_validate(p) for p in patients],
        meta={
            "page":        page,
            "page_size":   page_size,
            "total":       total,
            "total_pages": total_pages,
        },
    )


# ---------------------------------------------------------------------------
# GET /patients/{patient_id}
# ---------------------------------------------------------------------------
@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PatientOut:
    """Retrieve a specific patient. Requires ``patient:view`` permission."""
    if not await has_permission(db, current_user, "patient:view"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view patient profiles.",
        )

    result = await db.execute(
        select(Patient).filter(
            Patient.id == patient_id,
            Patient.tenant_id == current_user.tenant_id,
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    return patient


# ---------------------------------------------------------------------------
# PUT /patients/{patient_id}
# ---------------------------------------------------------------------------
@router.put("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: int,
    patient_in: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PatientOut:
    """Update patient details. Requires ``patient:update`` permission."""
    if not await has_permission(db, current_user, "patient:update"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update patient profiles.",
        )

    result = await db.execute(
        select(Patient).filter(
            Patient.id == patient_id,
            Patient.tenant_id == current_user.tenant_id,
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    for field, val in patient_in.model_dump(exclude_unset=True).items():
        setattr(patient, field, val)

    db.add(patient)
    try:
        await db.commit()
        await db.refresh(patient)
        return patient
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update patient: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# POST /patients/{patient_id}/archive
# ---------------------------------------------------------------------------
@router.post("/{patient_id}/archive", response_model=PatientOut)
async def archive_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PatientOut:
    """Toggle archive status. Requires ``patient:archive`` permission."""
    if not await has_permission(db, current_user, "patient:archive"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to archive patient records.",
        )

    result = await db.execute(
        select(Patient).filter(
            Patient.id == patient_id,
            Patient.tenant_id == current_user.tenant_id,
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    patient.is_archived = not patient.is_archived
    db.add(patient)
    try:
        await db.commit()
        await db.refresh(patient)
        return patient
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to archive patient: {str(exc)}",
        )
