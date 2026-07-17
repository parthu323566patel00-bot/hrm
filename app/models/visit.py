from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from datetime import datetime, timezone
from app.core.database import Base


class Visit(Base):
    __tablename__ = "visits"

    id             = Column(Integer, primary_key=True, index=True)
    tenant_id      = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, unique=True)
    patient_id     = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    status         = Column(String(20), default="IN_PROGRESS", nullable=False)
    started_at     = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    completed_at   = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), default=datetime.utcnow)
