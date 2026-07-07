from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from datetime import datetime, timezone
from app.core.database import Base


class VisitAuditLog(Base):
    __tablename__ = "visit_audit_logs"

    id             = Column(Integer, primary_key=True, index=True)
    visit_id       = Column(Integer, ForeignKey("visits.id"), nullable=False, index=True)
    tenant_id      = Column(String(50), nullable=False)
    action         = Column(String(50), nullable=False)
    actor_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    patient_id     = Column(Integer, nullable=False)
    appointment_id = Column(Integer, nullable=True)
    ip_address     = Column(String(45), nullable=True)
    metadata_json  = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
