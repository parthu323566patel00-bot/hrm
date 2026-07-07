from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from datetime import datetime, timezone
from app.core.database import Base


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id             = Column(Integer, primary_key=True, index=True)
    visit_id       = Column(Integer, ForeignKey("visits.id"), nullable=False, unique=True)
    is_immutable   = Column(Boolean, default=False, nullable=False)
    signed_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    signed_at      = Column(DateTime, nullable=True)
    signature_hash = Column(String(512), nullable=True)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))
