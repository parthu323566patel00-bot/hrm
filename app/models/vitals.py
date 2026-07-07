from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime
from datetime import datetime, timezone
from app.core.database import Base


class Vitals(Base):
    __tablename__ = "vitals"

    id               = Column(Integer, primary_key=True, index=True)
    visit_id         = Column(Integer, ForeignKey("visits.id"), nullable=False, index=True)
    systolic_bp      = Column(Integer, nullable=True)
    diastolic_bp     = Column(Integer, nullable=True)
    heart_rate       = Column(Integer, nullable=True)
    temperature      = Column(Float, nullable=True)
    spo2             = Column(Float, nullable=True)
    respiratory_rate = Column(Integer, nullable=True)
    weight_kg        = Column(Float, nullable=True)
    height_cm        = Column(Float, nullable=True)
    recorded_by      = Column(Integer, ForeignKey("users.id"), nullable=False)
    recorded_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
