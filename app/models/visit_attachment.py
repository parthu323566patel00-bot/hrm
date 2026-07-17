from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, BigInteger
from datetime import datetime, timezone
from app.core.database import Base


class VisitAttachment(Base):
    __tablename__ = "visit_attachments"

    id                = Column(Integer, primary_key=True, index=True)
    visit_id          = Column(Integer, ForeignKey("visits.id"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename   = Column(String(255), nullable=False, unique=True)
    file_size         = Column(BigInteger, nullable=False)
    mime_type         = Column(String(100), nullable=False)
    uploaded_by       = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at       = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
