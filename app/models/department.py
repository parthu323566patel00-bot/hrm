from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, UniqueConstraint
from app.core.database import Base

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_department_code"),
    )
