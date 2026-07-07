from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, BigInteger
from datetime import datetime, timezone
from app.core.database import Base


class AppointmentReport(Base):
    __tablename__ = "appointment_reports"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(
        Integer,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    file_size = Column(BigInteger, nullable=False)          # bytes
    mime_type = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
