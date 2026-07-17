from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Text
from app.core.database import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    po_number = Column(String(100), nullable=False, unique=True, index=True)
    purchase_date = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    expected_delivery_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), default="pending", nullable=False)
    remarks = Column(Text, nullable=True)
    total_amount = Column(Float, default=0.0, nullable=False)
    requisition_id = Column(Integer, ForeignKey("purchase_requisitions.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
