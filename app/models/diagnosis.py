from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from datetime import datetime, timezone
from app.core.database import Base


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id            = Column(Integer, primary_key=True, index=True)
    visit_id      = Column(Integer, ForeignKey("visits.id"), nullable=False, index=True)
    icd_code      = Column(String(20), nullable=True)
    description   = Column(Text, nullable=False)
    severity      = Column(String(20), default="moderate", nullable=False)
    diagnosed_by  = Column(Integer, ForeignKey("users.id"), nullable=False)
    diagnosed_at  = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
