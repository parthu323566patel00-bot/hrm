from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from datetime import datetime, timezone
from app.core.database import Base


class BillingItem(Base):
    __tablename__ = "billing_items"

    id          = Column(Integer, primary_key=True, index=True)
    visit_id    = Column(Integer, ForeignKey("visits.id"), nullable=False, index=True)
    tenant_id   = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    description = Column(String(300), nullable=False)
    amount      = Column(Float, default=0.0, nullable=False)
    currency    = Column(String(10), default="USD", nullable=False)
    status      = Column(String(20), default="PENDING", nullable=False)
    created_at  = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
