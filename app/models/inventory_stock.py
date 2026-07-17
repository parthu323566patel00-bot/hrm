from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime
from app.core.database import Base


class InventoryStock(Base):
    __tablename__ = "inventory_stocks"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, unique=True)
    available_quantity = Column(Float, default=0.0, nullable=False)
    total_quantity = Column(Float, default=0.0, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
