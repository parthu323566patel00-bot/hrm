from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from datetime import datetime, timezone
from app.core.database import Base

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    email = Column(String(100), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    token = Column(String(255), unique=True, index=True, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)
