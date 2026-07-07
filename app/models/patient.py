from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from datetime import datetime, timezone
from app.core.database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(150), nullable=False)
    age = Column(Integer, nullable=False)
    phone = Column(String(30), nullable=False)
    gender = Column(String(20), nullable=False)
    email = Column(String(100), nullable=True)
    blood_group = Column(String(10), nullable=True)
    address = Column(String(255), nullable=True)
    allergies = Column(String(500), nullable=True)
    notes = Column(String(1000), nullable=True)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
