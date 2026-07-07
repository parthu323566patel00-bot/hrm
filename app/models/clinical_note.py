from sqlalchemy import Column, Integer, ForeignKey, DateTime, Text
from datetime import datetime, timezone
from app.core.database import Base


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id         = Column(Integer, primary_key=True, index=True)
    visit_id   = Column(Integer, ForeignKey("visits.id"), nullable=False, index=True)
    content    = Column(Text, nullable=False)
    written_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    written_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
