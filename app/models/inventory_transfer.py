from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Text
from app.core.database import Base


class InventoryTransfer(Base):
    __tablename__ = "inventory_transfers"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), nullable=False, index=True)
    transfer_number = Column(String(100), nullable=False, unique=True, index=True)
    from_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=False)
    to_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(50), nullable=False, default="draft")
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
