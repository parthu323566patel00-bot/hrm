from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Float,
    Boolean,
    DateTime,
    UniqueConstraint,
)
from app.core.database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("tenant_id", "category_id", "name", name="uq_product_tenant_category_name"),
        UniqueConstraint("product_code", name="uq_product_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    product_code = Column(String(100), nullable=False, index=True, unique=True)
    name = Column(String(200), nullable=False)
    generic_name = Column(String(200), nullable=True)
    category_id = Column(Integer, ForeignKey("product_categories.id"), nullable=False)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units_of_measure.id"), nullable=False)
    default_supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=False)
    minimum_stock = Column(Float, default=0.0, nullable=False)
    maximum_stock = Column(Float, default=0.0, nullable=False)
    reorder_level = Column(Float, default=0.0, nullable=False)
    hsn_code = Column(String(50), nullable=True)
    gst_percent = Column(Float, default=0.0, nullable=False)
    description = Column(String(500), nullable=True)
    status = Column(String(20), default="active", nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
