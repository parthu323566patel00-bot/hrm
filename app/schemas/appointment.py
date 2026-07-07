from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int
    department_id: Optional[int] = None
    appointment_date: str   # "YYYY-MM-DD"
    time_slot: str          # "HH:MM"
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    notes: Optional[str] = None
    status: Optional[str] = None


class ReportOut(BaseModel):
    id: int
    original_filename: str
    file_size: int
    mime_type: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class AppointmentOut(BaseModel):
    id: int
    tenant_id: str
    patient_id: int
    doctor_id: int
    department_id: Optional[int]
    appointment_date: str
    time_slot: str
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    reports: List[ReportOut] = []

    class Config:
        from_attributes = True


class DoctorOut(BaseModel):
    id: int
    full_name: Optional[str]
    email: str
    departments: List[dict] = []

    class Config:
        from_attributes = True


class SlotInfo(BaseModel):
    time: str        # "HH:MM"
    available: bool
