from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from datetime import datetime, timezone
from app.core.database import Base


class LabOrder(Base):
    __tablename__ = "lab_orders"

    id             = Column(Integer, primary_key=True, index=True)
    visit_id       = Column(Integer, ForeignKey("visits.id"), nullable=False, index=True)
    test_name      = Column(String(200), nullable=False)
    clinical_notes = Column(Text, nullable=True)
    status         = Column(String(30), default="PENDING", nullable=False)
    ordered_by     = Column(Integer, ForeignKey("users.id"), nullable=False)
    ordered_at     = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
