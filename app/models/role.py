from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from app.core.database import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_tenant_role_name"),
    )
