from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float
from app.core.database import Base


class InventoryLedgerEntry(Base):
    __tablename__ = "inventory_ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    transaction_type = Column(String(50), nullable=False)
    quantity = Column(Float, nullable=False)
    before_quantity = Column(Float, nullable=False)
    after_quantity = Column(Float, nullable=False)
    reference_type = Column(String(50), nullable=False)
    reference_id = Column(Integer, nullable=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    goods_receipt_id = Column(Integer, ForeignKey("goods_receipts.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
