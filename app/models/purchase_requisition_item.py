from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, Float, DateTime, Text
from app.core.database import Base


class PurchaseRequisitionItem(Base):
    __tablename__ = "purchase_requisition_items"

    id = Column(Integer, primary_key=True, index=True)
    requisition_id = Column(Integer, ForeignKey("purchase_requisitions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    requested_quantity = Column(Float, nullable=False)
    estimated_unit_price = Column(Float, default=0.0, nullable=False)
    estimated_total = Column(Float, default=0.0, nullable=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
