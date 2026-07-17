from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


class PatientBase(BaseModel):
    name: str
    age: int
    phone: str
    gender: str
    email: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    allergies: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("age")
    @classmethod
    def age_must_be_positive(cls, v: int) -> int:
        if v <= 0 or v > 150:
            raise ValueError("Age must be between 1 and 150.")
        return v


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    allergies: Optional[str] = None
    notes: Optional[str] = None
    is_archived: Optional[bool] = None


class PatientOut(PatientBase):
    id: int
    tenant_id: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class PatientPageOut(BaseModel):
    data: List[PatientOut]
    meta: PageMeta
