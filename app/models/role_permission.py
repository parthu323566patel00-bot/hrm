from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from app.core.database import Base

class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)
    role_name = Column(String(50), nullable=False)


    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )
