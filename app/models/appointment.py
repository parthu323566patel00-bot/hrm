from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum
from datetime import datetime, timezone
from app.core.database import Base
import enum


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    checked_in = "checked_in"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    appointment_date = Column(String(10), nullable=False)   # "YYYY-MM-DD"
    time_slot = Column(String(5), nullable=False)            # "HH:MM"
    notes = Column(Text, nullable=True)
    status = Column(
        String(20),
        default=AppointmentStatus.scheduled,
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
