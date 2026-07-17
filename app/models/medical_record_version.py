from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from datetime import datetime, timezone
from app.core.database import Base


class MedicalRecordVersion(Base):
    __tablename__ = "medical_record_versions"

    id                = Column(Integer, primary_key=True, index=True)
    medical_record_id = Column(Integer, ForeignKey("medical_records.id"), nullable=False, index=True)
    snapshot          = Column(Text, nullable=False)   # JSON snapshot of prior state
    amended_by        = Column(Integer, ForeignKey("users.id"), nullable=False)
    amendment_reason  = Column(String(500), nullable=False)
    amended_at        = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
