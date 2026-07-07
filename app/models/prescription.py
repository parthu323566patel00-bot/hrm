from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from datetime import datetime, timezone
from app.core.database import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    id              = Column(Integer, primary_key=True, index=True)
    visit_id        = Column(Integer, ForeignKey("visits.id"), nullable=False, index=True)
    medication_name = Column(String(200), nullable=False)
    dosage          = Column(String(100), nullable=False)
    frequency       = Column(String(100), nullable=False)
    duration        = Column(String(100), nullable=False)
    route           = Column(String(50), nullable=False)
    instructions    = Column(Text, nullable=True)
    status          = Column(String(30), default="DRAFT", nullable=False)
    prescribed_by   = Column(Integer, ForeignKey("users.id"), nullable=False)
    prescribed_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
