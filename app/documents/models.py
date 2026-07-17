"""
app/documents/models.py
------------------------
SQLAlchemy models for the Document Management Pipeline.
Three tables:
  documents            — file metadata + lifecycle status
  document_content     — OCR text + structured JSON
  document_audit_logs  — append-only audit trail
"""

from sqlalchemy import (
    BigInteger, Boolean, Column, Float, ForeignKey,
    Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.types import DateTime
from datetime import datetime, timezone

from app.core.database import Base


def _now():
    return datetime.utcnow()


class Document(Base):
    __tablename__ = "documents"

    id                   = Column(Integer, primary_key=True, index=True)
    tenant_id            = Column(String(50), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id           = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    visit_id             = Column(Integer, ForeignKey("visits.id", ondelete="SET NULL"), nullable=True, index=True)
    uploaded_by          = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_type        = Column(String(50), nullable=False, default="misc")
    original_filename    = Column(String(255), nullable=False)
    stored_filename      = Column(String(255), nullable=False, unique=True)
    storage_path         = Column(String(500), nullable=False)
    file_size            = Column(BigInteger, nullable=False)
    mime_type            = Column(String(100), nullable=False)
    sha256_hash          = Column(String(64), nullable=False, index=True)
    is_duplicate         = Column(Boolean, default=False, nullable=False)
    original_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    status               = Column(String(40), nullable=False, default="UPLOADING", index=True)
    is_deleted           = Column(Boolean, default=False, nullable=False)
    uploaded_at          = Column(DateTime(timezone=True), default=_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "patient_id", "sha256_hash",
                         name="uq_doc_tenant_patient_hash"),
    )


class DocumentContent(Base):
    __tablename__ = "document_content"

    id               = Column(Integer, primary_key=True, index=True)
    document_id      = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"),
                              nullable=False, unique=True, index=True)
    raw_text         = Column(Text, nullable=True)
    structured_json  = Column(JSON, nullable=True)
    ocr_engine       = Column(String(50), nullable=True)
    ocr_status       = Column(String(20), default="pending", nullable=False)
    classified_as    = Column(String(50), nullable=True)
    confidence       = Column(Float, nullable=True)
    parser_version   = Column(String(20), nullable=True)
    parsed_at        = Column(DateTime(timezone=True), nullable=True)


class DocumentAuditLog(Base):
    __tablename__ = "document_audit_logs"

    id            = Column(Integer, primary_key=True, index=True)
    document_id   = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    actor_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    tenant_id     = Column(String(50), nullable=False)
    action        = Column(String(30), nullable=False)   # uploaded|downloaded|viewed|deleted|retry|processing_*
    ip_address    = Column(String(45), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), default=_now, nullable=False)
