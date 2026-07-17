"""
app/documents/upload.py
------------------------
DocumentUploadService — orchestrates the synchronous upload flow.

Steps (all happen BEFORE returning HTTP 201):
  1. Validate file (MIME + magic bytes + extension)
  2. Read file into memory (for SHA-256 + YARA scan — max 50 MB)
  3. Malware scan
  4. Compute SHA-256
  5. Duplicate detection
  6. Store file (if not duplicate)
  7. Insert Document metadata with status=QUEUED
  8. Return document_id

Background worker is enqueued by the caller (endpoint) after this returns.
"""

import hashlib
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.documents.models import Document
from app.documents.services.audit import audit_service
from app.documents.services.hash_service import compute_sha256
from app.documents.services.storage import storage_provider
from app.documents.services.virus_scan import virus_scanner
from app.core.constants.roles import RoleId

logger = logging.getLogger(__name__)

# ── Security constants ────────────────────────────────────────────────────────
MAX_FILE_BYTES = 50 * 1024 * 1024  # 50 MB

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif"}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/jpg",
}

# Magic byte signatures for validation (prevent MIME spoofing)
MAGIC_BYTES = {
    b"\x25\x50\x44\x46":  "application/pdf",     # PDF
    b"\xff\xd8\xff":       "image/jpeg",           # JPEG
    b"\x89\x50\x4e\x47":  "image/png",            # PNG
    b"\x49\x49\x2a\x00":  "image/tiff",           # TIFF LE
    b"\x4d\x4d\x00\x2a":  "image/tiff",           # TIFF BE
}

ROLE_UPLOAD_ALLOWED = {
    RoleId.SUPER_ADMIN, RoleId.HOSPITAL_ADMIN, RoleId.RECEPTIONIST,
    RoleId.DOCTOR, RoleId.NURSE, RoleId.LAB_TECHNICIAN, RoleId.RADIOLOGIST,
    RoleId.BILLING_CLERK,
}   # Pharmacist(8) and Inventory Manager(10) cannot upload documents


def _detect_magic(data: bytes) -> Optional[str]:
    for magic, mime in MAGIC_BYTES.items():
        if data[:len(magic)] == magic:
            return mime
    return None


def _validate_file(file: UploadFile, data: bytes) -> str:
    """Validate extension, MIME, magic bytes. Returns detected MIME."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' is not allowed.",
        )

    detected = _detect_magic(data)
    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content could not be verified. Unsupported or corrupt file.",
        )

    if detected not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Detected file type '{detected}' is not allowed.",
        )

    # Reject executables masquerading as documents
    if data[:2] == b"MZ":   # Windows PE
        raise HTTPException(status_code=400, detail="Executable files are not allowed.")

    return detected


class DocumentUploadService:

    async def upload(
        self,
        db: AsyncSession,
        *,
        file: UploadFile,
        patient_id: int,
        tenant_id: str,
        uploaded_by: int,
        role_id: int,
        visit_id: Optional[int] = None,
        document_type: str = "misc",
        ip_address: Optional[str] = None,
    ) -> Document:
        # ── RBAC ──────────────────────────────────────────────────────────
        if role_id not in ROLE_UPLOAD_ALLOWED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your role does not have upload permissions.",
            )

        # ── Read file (size-limited) ───────────────────────────────────────
        data = await file.read(MAX_FILE_BYTES + 1)
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds the 50 MB limit.",
            )
        file_size = len(data)

        # ── Validate ──────────────────────────────────────────────────────
        detected_mime = _validate_file(file, data)

        # ── Malware scan ──────────────────────────────────────────────────
        # OPTIMIZATION: For small files (< 10MB), scan directly from memory
        # For larger files, use temp file (keeps memory bounded)
        SMALL_FILE_THRESHOLD = 10 * 1024 * 1024  # 10MB
        
        temp_path = None
        try:
            if file_size < SMALL_FILE_THRESHOLD:
                # Small files: scan from memory (no disk I/O)
                logger.debug("Scanning small file (%d bytes) from memory", file_size)
                # Scan directly using yara_scanner.scan_bytes()
                from app.documents.services.yara_scanner import yara_scanner
                from app.documents.services.virus_scan import VirusScanResult
                result = yara_scanner.scan_bytes(data, file.filename or "<upload>")
                scan = VirusScanResult(
                    is_clean=result.is_clean,
                    threat=", ".join(result.matched_rules) if result.matched_rules else "malware detected",
                    error=result.error,
                    matched_rules=result.matched_rules,
                    matched_tags=result.matched_tags,
                    matched_meta=result.matched_meta,
                    scan_duration=result.scan_duration,
                )
            else:
                # Large files: use temp file (memory-efficient)
                logger.debug("Scanning large file (%d bytes) via temp file", file_size)
                with tempfile.NamedTemporaryFile(delete=False, suffix=".upload") as tmp:
                    tmp.write(data)
                    tmp.flush()
                    temp_path = tmp.name
                
                scan = await virus_scanner.scan(temp_path, file.filename or "<upload>")
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    logger.warning("Failed to delete temporary scan file.")

        if scan.error:
            logger.error(
                "YARA scanning failed for upload [filename=%s error=%s]",
                file.filename or "<upload>", scan.error,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="File scanning failed. Please try again later.",
            )

        if not scan.is_clean:
            logger.warning(
                "Malware detected in uploaded file [filename=%s rules=%s tags=%s]",
                file.filename or "<upload>", scan.matched_rules, scan.matched_tags,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File rejected: malware detected.",
            )

        # ── SHA-256 ───────────────────────────────────────────────────────
        sha256 = compute_sha256(data)
        logger.info("Upload hash [patient=%d sha256=%s]", patient_id, sha256[:16])

        # ── Duplicate detection ───────────────────────────────────────────
        dup_res = await db.execute(
            select(Document).filter(
                Document.tenant_id  == tenant_id,
                Document.patient_id == patient_id,
                Document.sha256_hash == sha256,
                Document.is_deleted  == False,   # noqa: E712
            )
        )
        original = dup_res.scalars().first()
        is_duplicate = original is not None

        # ── Store file (only if not a duplicate) ──────────────────────────
        ext          = os.path.splitext(file.filename or "file")[1].lower()
        stored_name  = f"{uuid.uuid4().hex}{ext}"
        storage_path = f"{tenant_id}/{patient_id}/{stored_name}"

        if not is_duplicate:
            await storage_provider.save(storage_path, data)
            logger.info("File stored [path=%s size=%d]", storage_path, file_size)
        else:
            # Reuse original path — no disk write
            storage_path  = original.storage_path
            stored_name   = original.stored_filename
            logger.info("Duplicate detected [original_doc=%d]", original.id)

        # ── Insert metadata ───────────────────────────────────────────────
        doc = Document(
            tenant_id            = tenant_id,
            patient_id           = patient_id,
            visit_id             = visit_id,
            uploaded_by          = uploaded_by,
            document_type        = document_type,
            original_filename    = file.filename or stored_name,
            stored_filename      = stored_name,
            storage_path         = storage_path,
            file_size            = file_size,
            mime_type            = detected_mime,
            sha256_hash          = sha256,
            is_duplicate         = is_duplicate,
            original_document_id = original.id if is_duplicate else None,
            status               = "QUEUED",
            uploaded_at          = datetime.utcnow(),
        )
        db.add(doc)
        try:
            await db.commit()
            await db.refresh(doc)
        except Exception as exc:
            await db.rollback()
            # If we stored a file, clean it up
            if not is_duplicate:
                await storage_provider.delete(storage_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save document metadata: {exc}",
            )

        return doc


document_upload_service = DocumentUploadService()
