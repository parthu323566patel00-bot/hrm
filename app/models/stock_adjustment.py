from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Text
from app.core.database import Base


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), nullable=False, index=True)
    adjustment_number = Column(String(100), nullable=False, unique=True, index=True)
    reason = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="draft")
    remarks = Column(Text, nullable=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
