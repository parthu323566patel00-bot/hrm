"""
app/documents/endpoints.py
----------------------------
Document Management API endpoints.

POST   /documents/upload
GET    /documents/{id}/status
GET    /documents/{id}
GET    /documents/{id}/file
GET    /documents/{id}/content
GET    /patients/{patient_id}/documents
POST   /documents/{id}/retry-processing
DELETE /documents/{id}
"""

import logging
from typing import Any, List, Optional

from fastapi import (
    APIRouter, BackgroundTasks, Depends, Form,
    HTTPException, Request, UploadFile, File, status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.constants.roles import RoleId
from app.core.database import get_db
from app.documents.models import Document, DocumentContent, DocumentAuditLog
from app.documents.schemas import (
    DocumentContentOut, DocumentMetaOut, DocumentStatusOut, UploadResponse,
)
from app.documents.services.audit import audit_service
from app.documents.services.processing import run_processing
from app.documents.services.storage import storage_provider
from app.documents.upload import document_upload_service
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

DOWNLOAD_ALLOWED_ROLES = {
    RoleId.SUPER_ADMIN, RoleId.HOSPITAL_ADMIN, RoleId.DOCTOR,
    RoleId.NURSE, RoleId.LAB_TECHNICIAN, RoleId.RADIOLOGIST, RoleId.BILLING_CLERK,
}   # Pharmacist(8) can only download prescriptions
TERMINAL_STATUSES = {"READY", "FAILED", "MANUAL_REVIEW_REQUIRED"}


def _ip(request: Request) -> Optional[str]:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)


async def _get_doc_or_404(db: AsyncSession, doc_id: int, tenant_id: str) -> Document:
    res = await db.execute(
        select(Document).filter(
            Document.id == doc_id,
            Document.tenant_id == tenant_id,
            Document.is_deleted == False,  # noqa: E712
        )
    )
    doc = res.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


# ── POST /documents/upload ────────────────────────────────────────────────────
@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    patient_id: int = Form(...),
    visit_id: Optional[int] = Form(None),
    document_type: str = Form("misc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Upload a document. Returns immediately after storing the file.
    OCR and parsing happen in the background.
    Poll GET /documents/{id}/status to track progress.
    """
    doc = await document_upload_service.upload(
        db,
        file=file,
        patient_id=patient_id,
        tenant_id=current_user.tenant_id,
        uploaded_by=current_user.id,
        role_id=current_user.role_id or 0,
        visit_id=visit_id,
        document_type=document_type,
        ip_address=_ip(request),
    )

    # Audit — uploaded
    await audit_service.log(
        db, document_id=doc.id, actor_id=current_user.id,
        tenant_id=current_user.tenant_id, action="uploaded",
        ip_address=_ip(request),
        meta={"filename": doc.original_filename, "size": doc.file_size},
    )

    # Enqueue background processing (HTTP response returns BEFORE this runs)
    if not doc.is_duplicate:
        background_tasks.add_task(
            run_processing, doc.id, current_user.id, current_user.tenant_id
        )

    return UploadResponse(
        document_id=doc.id,
        status=doc.status,
        is_duplicate=doc.is_duplicate,
        message="File uploaded successfully. Processing started." if not doc.is_duplicate
                else "Duplicate file detected. Linked to existing document.",
    )


# ── GET /documents/{id}/status ────────────────────────────────────────────────
@router.get("/{doc_id}/status", response_model=DocumentStatusOut)
async def get_document_status(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Poll this endpoint every 2 s. Stop when status is READY/FAILED/MANUAL_REVIEW_REQUIRED."""
    doc = await _get_doc_or_404(db, doc_id, current_user.tenant_id)
    return doc


# ── GET /documents/{id} — metadata only ──────────────────────────────────────
@router.get("/{doc_id}", response_model=DocumentMetaOut)
async def get_document_meta(
    doc_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    doc = await _get_doc_or_404(db, doc_id, current_user.tenant_id)
    await audit_service.log(
        db, document_id=doc_id, actor_id=current_user.id,
        tenant_id=current_user.tenant_id, action="viewed",
        ip_address=_ip(request),
    )
    return doc


# ── GET /documents/{id}/file — stream original file ──────────────────────────
@router.get("/{doc_id}/file")
async def download_document(
    doc_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    role = current_user.role_id or 0

    # Pharmacist can only download prescriptions
    if role == RoleId.PHARMACIST:
        doc = await _get_doc_or_404(db, doc_id, current_user.tenant_id)
        if doc.document_type != "prescription":
            raise HTTPException(status_code=403, detail="Access denied.")
    elif role not in DOWNLOAD_ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Your role cannot download documents.")
    else:
        doc = await _get_doc_or_404(db, doc_id, current_user.tenant_id)

    file_bytes = await storage_provider.read_bytes(doc.storage_path)

    await audit_service.log(
        db, document_id=doc_id, actor_id=current_user.id,
        tenant_id=current_user.tenant_id, action="downloaded",
        ip_address=_ip(request),
    )

    return StreamingResponse(
        iter([file_bytes]),
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{doc.original_filename}"',
            "Content-Length": str(doc.file_size),
        },
    )


# ── GET /documents/{id}/content — OCR text + structured JSON ─────────────────
@router.get("/{doc_id}/content", response_model=DocumentContentOut)
async def get_document_content(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    await _get_doc_or_404(db, doc_id, current_user.tenant_id)
    res = await db.execute(
        select(DocumentContent).filter(DocumentContent.document_id == doc_id)
    )
    content = res.scalars().first()
    if not content:
        raise HTTPException(status_code=404, detail="Document content not yet available.")
    return content


# ── GET /patients/{patient_id}/documents — list metadata only ─────────────────
@router.get("/patient/{patient_id}", response_model=List[DocumentMetaOut])
async def list_patient_documents(
    patient_id: int,
    visit_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    q = select(Document).filter(
        Document.tenant_id == current_user.tenant_id,
        Document.patient_id == patient_id,
        Document.is_deleted == False,   # noqa: E712
    )
    if visit_id is not None:
        q = q.filter(Document.visit_id == visit_id)
    q = q.order_by(Document.uploaded_at.desc())
    res = await db.execute(q)
    return res.scalars().all()


# ── POST /documents/{id}/retry-processing ─────────────────────────────────────
@router.post("/{doc_id}/retry-processing")
async def retry_processing(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    doc = await _get_doc_or_404(db, doc_id, current_user.tenant_id)
    if doc.status not in ("FAILED", "MANUAL_REVIEW_REQUIRED"):
        raise HTTPException(
            status_code=400,
            detail=f"Can only retry FAILED documents. Current status: {doc.status}",
        )

    # Delete stale content record if any
    res = await db.execute(
        select(DocumentContent).filter(DocumentContent.document_id == doc_id)
    )
    stale = res.scalars().first()
    if stale:
        await db.delete(stale)

    doc.status = "QUEUED"
    db.add(doc)
    await db.commit()

    background_tasks.add_task(
        run_processing, doc.id, current_user.id, current_user.tenant_id
    )

    await audit_service.log(
        db, document_id=doc_id, actor_id=current_user.id,
        tenant_id=current_user.tenant_id, action="retry_processing",
    )

    return {"message": "Retry queued.", "document_id": doc_id, "status": "QUEUED"}


# ── DELETE /documents/{id} — soft delete ──────────────────────────────────────
@router.delete("/{doc_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    doc_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if current_user.role_id not in (RoleId.SUPER_ADMIN, RoleId.HOSPITAL_ADMIN):
        raise HTTPException(status_code=403, detail="Only admins can delete documents.")

    doc = await _get_doc_or_404(db, doc_id, current_user.tenant_id)
    doc.is_deleted = True
    db.add(doc)
    await db.commit()

    await audit_service.log(
        db, document_id=doc_id, actor_id=current_user.id,
        tenant_id=current_user.tenant_id, action="deleted",
        ip_address=_ip(request),
    )

    return {"message": "Document deleted.", "document_id": doc_id}
