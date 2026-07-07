"""
app/api/v1/endpoints/departments.py
-------------------------------------
Department listing endpoint — returns all active departments for the
authenticated user's tenant.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user          # ← shared dependency
from app.core.database import get_db
from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentOut

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /departments/
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DepartmentOut]:
    """List all active departments for the logged-in user's tenant."""
    result = await db.execute(
        select(Department).filter(
            Department.tenant_id == current_user.tenant_id,
            Department.is_active == True,  # noqa: E712
        )
    )
    return result.scalars().all()
