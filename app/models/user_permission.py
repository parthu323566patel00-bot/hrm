from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, UniqueConstraint
from app.core.database import Base

class UserPermission(Base):
    __tablename__ = "user_permissions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)
    is_granted = Column(Boolean, default=True)  # True = Added, False = Explicitly Revoked
    effect = Column(String(10), default="allow", nullable=False)  # "allow" | "deny"
    user_name = Column(String(100), nullable=False)


    __table_args__ = (
        UniqueConstraint("user_id", "permission_id", name="uq_user_permission"),
    )
