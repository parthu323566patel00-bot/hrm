from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from datetime import datetime, timezone
from app.core.database import Base


class RadiologyOrder(Base):
    __tablename__ = "radiology_orders"

    id                  = Column(Integer, primary_key=True, index=True)
    visit_id            = Column(Integer, ForeignKey("visits.id"), nullable=False, index=True)
    imaging_type        = Column(String(100), nullable=False)
    body_region         = Column(String(100), nullable=False)
    clinical_indication = Column(Text, nullable=False)
    status              = Column(String(30), default="PENDING", nullable=False)
    ordered_by          = Column(Integer, ForeignKey("users.id"), nullable=False)
    ordered_at          = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
