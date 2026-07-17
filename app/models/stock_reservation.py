from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Text
from app.core.database import Base


class StockReservation(Base):
    __tablename__ = "stock_reservations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_number = Column(String(150), nullable=True)
    quantity = Column(Float, nullable=False, default=0.0)
    expiry_datetime = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), nullable=False, default="active")
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
