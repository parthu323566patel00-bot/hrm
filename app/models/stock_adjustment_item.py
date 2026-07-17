from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Text
from app.core.database import Base


class StockAdjustmentItem(Base):
    __tablename__ = "stock_adjustment_items"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), nullable=False, index=True)
    adjustment_id = Column(Integer, ForeignKey("stock_adjustments.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_number = Column(String(150), nullable=True)
    quantity = Column(Float, nullable=False, default=0.0)
    unit_cost = Column(Float, nullable=True, default=0.0)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
