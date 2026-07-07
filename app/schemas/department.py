from pydantic import BaseModel
from typing import Optional

class DepartmentBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    is_active: Optional[bool] = True

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: int
    tenant_id: str

    class Config:
        from_attributes = True
