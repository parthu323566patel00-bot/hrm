from sqlalchemy import Column, String, Boolean, DateTime
from datetime import datetime, timezone
from app.core.database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
