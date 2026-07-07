"""
app/api/v1/endpoints/visits.py
--------------------------------
Patient Visit & Medical Record Lifecycle endpoints.
"""
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.billing_item import BillingItem
from app.models.clinical_note import ClinicalNote
from app.models.diagnosis import Diagnosis
from app.models.lab_order import LabOrder
from app.models.medical_record import MedicalRecord
from app.models.medical_record_version import MedicalRecordVersion
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.radiology_order import RadiologyOrder
from app.models.user import User
from app.models.visit import Visit
from app.models.visit_attachment import VisitAttachment
from app.models.visit_audit_log import VisitAuditLog
from app.models.vitals import Vitals
from app.schemas.visit import (
    AmendmentRequest, AttachmentOut, AuditLogOut, BillingItemOut,
    ClinicalNoteCreate, ClinicalNoteOut, DiagnosisCreate, DiagnosisOut,
    LabOrderCreate, LabOrderOut, MedicalRecordOut, PrescriptionCreate,
    PrescriptionOut, RadiologyOrderCreate, RadiologyOrderOut,
    StartConsultationRequest, StartConsultationResponse,
    VitalsCreate, VitalsOut, VisitChartOut, VisitSummaryOut,
)

router = APIRouter()

VISIT_ATTACHMENT_ROOT = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..", "uploads", "visits"
)
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_ATTACHMENT_EXT = {".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".dcm"}


def _ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host if request.client else None


def _audit(db: AsyncSession, *, visit_id: int, action: str, actor_id: int,
           patient_id: int, tenant_id: str, appointment_id: Optional[int] = None,
           ip: Optional[str] = None, meta: Optional[dict] = None) -> VisitAuditLog:
    log = VisitAuditLog(
        visit_id=visit_id, tenant_id=tenant_id, action=action,
        actor_id=actor_id, patient_id=patient_id, appointment_id=appointment_id,
        ip_address=ip, metadata_json=json.dumps(meta) if meta else None,
    )
    db.add(log)
    return log


async def _get_visit_or_404(db: AsyncSession, visit_id: int, tenant_id: str) -> Visit:
    res = await db.execute(
        select(Visit).filter(Visit.id == visit_id, Visit.tenant_id == tenant_id)
    )
    visit = res.scalars().first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    return visit


async def _require_active_visit(visit: Visit):
    if visit.status != "IN_PROGRESS":
        raise HTTPException(status_code=409, detail="Visit is not active.")


async def _build_chart(db: AsyncSession, visit: Visit) -> VisitChartOut:
    async def fetch(model, visit_id):
        r = await db.execute(select(model).filter(model.visit_id == visit_id))
        return r.scalars().all()

    mr_res = await db.execute(select(MedicalRecord).filter(MedicalRecord.visit_id == visit.id))
    mr = mr_res.scalars().first()

    diag_res = await db.execute(select(Diagnosis).filter(Diagnosis.visit_id == visit.id))
    diags = diag_res.scalars().all()
    primary_dx = diags[0].description if diags else None

    return VisitChartOut(
        id=visit.id, tenant_id=visit.tenant_id,
        appointment_id=visit.appointment_id,
        patient_id=visit.patient_id, doctor_id=visit.doctor_id,
        status=visit.status, started_at=visit.started_at,
        completed_at=visit.completed_at,
        medical_record=MedicalRecordOut.model_validate(mr) if mr else None,
        vitals=await fetch(Vitals, visit.id),
        notes=await fetch(ClinicalNote, visit.id),
        diagnoses=diags,
        prescriptions=await fetch(Prescription, visit.id),
        lab_orders=await fetch(LabOrder, visit.id),
        radiology_orders=await fetch(RadiologyOrder, visit.id),
        attachments=await fetch(VisitAttachment, visit.id),
        billing_items=await fetch(BillingItem, visit.id),
    )


# ── POST /visits/start ────────────────────────────────────────────────────────
@router.post("/start", response_model=StartConsultationResponse,
             status_code=status.HTTP_201_CREATED)
async def start_consultation(
    body: StartConsultationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Atomically create Visit + MedicalRecord + AuditLog for a checked-in appointment."""
    if current_user.role_id != 4:
        raise HTTPException(status_code=403, detail="Only doctors can start consultations.")

    appt_res = await db.execute(
        select(Appointment).filter(
            Appointment.id == body.appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = appt_res.scalars().first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if appt.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the assigned doctor.")
    if appt.status != "checked_in":
        raise HTTPException(status_code=409,
            detail=f"Appointment must be checked_in to start consultation. Current: {appt.status}.")

    existing_res = await db.execute(
        select(Visit).filter(
            Visit.appointment_id == body.appointment_id,
            Visit.status == "IN_PROGRESS",
        )
    )
    if existing_res.scalars().first():
        raise HTTPException(status_code=409,
            detail="A consultation is already active for this appointment.")

    now = datetime.now(timezone.utc)
    try:
        visit = Visit(
            tenant_id=current_user.tenant_id,
            appointment_id=appt.id,
            patient_id=appt.patient_id,
            doctor_id=current_user.id,
            status="IN_PROGRESS",
            started_at=now,
        )
        db.add(visit)
        await db.flush()

        mr = MedicalRecord(visit_id=visit.id)
        db.add(mr)

        appt.status = "in_progress"
        db.add(appt)

        _audit(db, visit_id=visit.id, action="VISIT_STARTED",
               actor_id=current_user.id, patient_id=appt.patient_id,
               tenant_id=current_user.tenant_id, appointment_id=appt.id,
               ip=_ip(request))

        await db.commit()
        await db.refresh(visit)
        await db.refresh(mr)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to start consultation: {exc}")

    return StartConsultationResponse(
        visit_id=visit.id, medical_record_id=mr.id,
        status=visit.status, started_at=visit.started_at,
    )


# ── GET /visits/{visit_id} ────────────────────────────────────────────────────
@router.get("/{visit_id}", response_model=VisitChartOut)
async def get_visit_chart(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    if current_user.role_id not in (1, 2) and visit.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return await _build_chart(db, visit)


# ── GET /visits/patient/{patient_id} ─────────────────────────────────────────
@router.get("/patient/{patient_id}", response_model=List[VisitSummaryOut])
async def get_patient_history(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    res = await db.execute(
        select(Visit).filter(
            Visit.patient_id == patient_id,
            Visit.tenant_id == current_user.tenant_id,
            Visit.status == "COMPLETED",
        ).order_by(Visit.started_at.desc())
    )
    visits = res.scalars().all()
    out = []
    for v in visits:
        diag_res = await db.execute(
            select(Diagnosis).filter(Diagnosis.visit_id == v.id).limit(1)
        )
        d = diag_res.scalars().first()
        out.append(VisitSummaryOut(
            id=v.id, appointment_id=v.appointment_id,
            doctor_id=v.doctor_id, status=v.status,
            started_at=v.started_at, completed_at=v.completed_at,
            primary_diagnosis=d.description if d else None,
        ))
    return out


# ── POST /visits/{visit_id}/vitals ────────────────────────────────────────────
@router.post("/{visit_id}/vitals", response_model=VitalsOut,
             status_code=status.HTTP_201_CREATED)
async def add_vitals(
    visit_id: int, body: VitalsCreate, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    if not any([body.systolic_bp, body.diastolic_bp, body.heart_rate, body.temperature,
                body.spo2, body.respiratory_rate, body.weight_kg, body.height_cm]):
        raise HTTPException(status_code=422, detail="At least one vitals field required.")
    v = Vitals(visit_id=visit_id, recorded_by=current_user.id, **body.model_dump())
    db.add(v)
    _audit(db, visit_id=visit_id, action="VITALS_RECORDED",
           actor_id=current_user.id, patient_id=visit.patient_id,
           tenant_id=current_user.tenant_id, ip=_ip(request))
    await db.commit()
    await db.refresh(v)
    return v


# ── POST /visits/{visit_id}/notes ─────────────────────────────────────────────
@router.post("/{visit_id}/notes", response_model=ClinicalNoteOut,
             status_code=status.HTTP_201_CREATED)
async def add_note(
    visit_id: int, body: ClinicalNoteCreate, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    note = ClinicalNote(visit_id=visit_id, content=body.content, written_by=current_user.id)
    db.add(note)
    _audit(db, visit_id=visit_id, action="NOTES_UPDATED",
           actor_id=current_user.id, patient_id=visit.patient_id,
           tenant_id=current_user.tenant_id, ip=_ip(request))
    await db.commit()
    await db.refresh(note)
    return note


# ── PUT /visits/{visit_id}/notes/{note_id} ────────────────────────────────────
@router.put("/{visit_id}/notes/{note_id}", response_model=ClinicalNoteOut)
async def update_note(
    visit_id: int, note_id: int, body: ClinicalNoteCreate, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    res = await db.execute(
        select(ClinicalNote).filter(ClinicalNote.id == note_id, ClinicalNote.visit_id == visit_id)
    )
    note = res.scalars().first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    note.content = body.content
    db.add(note)
    _audit(db, visit_id=visit_id, action="NOTES_UPDATED",
           actor_id=current_user.id, patient_id=visit.patient_id,
           tenant_id=current_user.tenant_id, ip=_ip(request))
    await db.commit()
    await db.refresh(note)
    return note


# ── POST /visits/{visit_id}/diagnoses ─────────────────────────────────────────
@router.post("/{visit_id}/diagnoses", response_model=DiagnosisOut,
             status_code=status.HTTP_201_CREATED)
async def add_diagnosis(
    visit_id: int, body: DiagnosisCreate, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    d = Diagnosis(visit_id=visit_id, diagnosed_by=current_user.id, **body.model_dump())
    db.add(d)
    _audit(db, visit_id=visit_id, action="DIAGNOSIS_SAVED",
           actor_id=current_user.id, patient_id=visit.patient_id,
           tenant_id=current_user.tenant_id, ip=_ip(request))
    await db.commit()
    await db.refresh(d)
    return d


# ── POST /visits/{visit_id}/prescriptions ────────────────────────────────────
@router.post("/{visit_id}/prescriptions", response_model=PrescriptionOut,
             status_code=status.HTTP_201_CREATED)
async def add_prescription(
    visit_id: int, body: PrescriptionCreate, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    p = Prescription(visit_id=visit_id, prescribed_by=current_user.id, **body.model_dump())
    db.add(p)
    _audit(db, visit_id=visit_id, action="PRESCRIPTION_CREATED",
           actor_id=current_user.id, patient_id=visit.patient_id,
           tenant_id=current_user.tenant_id, ip=_ip(request))
    await db.commit()
    await db.refresh(p)
    return p


# ── POST /visits/{visit_id}/lab-orders ────────────────────────────────────────
@router.post("/{visit_id}/lab-orders", response_model=LabOrderOut,
             status_code=status.HTTP_201_CREATED)
async def add_lab_order(
    visit_id: int, body: LabOrderCreate, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    lo = LabOrder(visit_id=visit_id, ordered_by=current_user.id, **body.model_dump())
    db.add(lo)
    _audit(db, visit_id=visit_id, action="LAB_ORDER_CREATED",
           actor_id=current_user.id, patient_id=visit.patient_id,
           tenant_id=current_user.tenant_id, ip=_ip(request))
    await db.commit()
    await db.refresh(lo)
    return lo


# ── POST /visits/{visit_id}/radiology-orders ─────────────────────────────────
@router.post("/{visit_id}/radiology-orders", response_model=RadiologyOrderOut,
             status_code=status.HTTP_201_CREATED)
async def add_radiology_order(
    visit_id: int, body: RadiologyOrderCreate, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    ro = RadiologyOrder(visit_id=visit_id, ordered_by=current_user.id, **body.model_dump())
    db.add(ro)
    _audit(db, visit_id=visit_id, action="RADIOLOGY_ORDER_CREATED",
           actor_id=current_user.id, patient_id=visit.patient_id,
           tenant_id=current_user.tenant_id, ip=_ip(request))
    await db.commit()
    await db.refresh(ro)
    return ro


# ── POST /visits/{visit_id}/attachments ──────────────────────────────────────
@router.post("/{visit_id}/attachments", response_model=List[AttachmentOut],
             status_code=status.HTTP_201_CREATED)
async def upload_attachments(
    visit_id: int, files: List[UploadFile] = File(...), request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    upload_dir = os.path.join(VISIT_ATTACHMENT_ROOT, str(visit_id))
    os.makedirs(upload_dir, exist_ok=True)
    saved = []
    for f in files:
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_ATTACHMENT_EXT:
            raise HTTPException(status_code=400, detail=f"'{f.filename}': unsupported type.")
        content = await f.read()
        if len(content) > MAX_ATTACHMENT_SIZE:
            raise HTTPException(status_code=400, detail=f"'{f.filename}' exceeds 10 MB.")
        stored = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(upload_dir, stored), "wb") as fh:
            fh.write(content)
        att = VisitAttachment(
            visit_id=visit_id, original_filename=f.filename, stored_filename=stored,
            file_size=len(content), mime_type=f.content_type or "application/octet-stream",
            uploaded_by=current_user.id,
        )
        db.add(att)
        saved.append(att)
    if saved:
        _audit(db, visit_id=visit_id, action="ATTACHMENT_UPLOADED",
               actor_id=current_user.id, patient_id=visit.patient_id,
               tenant_id=current_user.tenant_id, ip=_ip(request) if request else None,
               meta={"count": len(saved)})
        await db.commit()
        for a in saved:
            await db.refresh(a)
    return saved


# ── POST /visits/{visit_id}/sign ──────────────────────────────────────────────
@router.post("/{visit_id}/sign", response_model=MedicalRecordOut)
async def sign_consultation(
    visit_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    if visit.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned doctor can sign.")
    mr_res = await db.execute(select(MedicalRecord).filter(MedicalRecord.visit_id == visit_id))
    mr = mr_res.scalars().first()
    if not mr:
        raise HTTPException(status_code=404, detail="Medical record not found.")
    if mr.signature_hash:
        raise HTTPException(status_code=409, detail="Medical record is already signed.")

    now = datetime.now(timezone.utc)
    payload = f"{visit_id}:{current_user.id}:{now.isoformat()}"
    sig = hashlib.sha256(payload.encode()).hexdigest()
    mr.signed_by = current_user.id
    mr.signed_at = now
    mr.signature_hash = sig
    db.add(mr)
    _audit(db, visit_id=visit_id, action="RECORD_SIGNED",
           actor_id=current_user.id, patient_id=visit.patient_id,
           tenant_id=current_user.tenant_id, ip=_ip(request))
    await db.commit()
    await db.refresh(mr)
    return mr


# ── POST /visits/{visit_id}/complete ─────────────────────────────────────────
@router.post("/{visit_id}/complete", response_model=VisitChartOut)
async def complete_consultation(
    visit_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    await _require_active_visit(visit)
    if visit.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned doctor can complete.")

    mr_res = await db.execute(select(MedicalRecord).filter(MedicalRecord.visit_id == visit_id))
    mr = mr_res.scalars().first()
    if not mr or not mr.signature_hash:
        raise HTTPException(status_code=409, detail="Medical record must be signed before completing.")

    appt_res = await db.execute(select(Appointment).filter(Appointment.id == visit.appointment_id))
    appt = appt_res.scalars().first()

    now = datetime.now(timezone.utc)
    try:
        visit.status = "COMPLETED"
        visit.completed_at = now
        db.add(visit)

        mr.is_immutable = True
        db.add(mr)

        if appt:
            appt.status = "completed"
            db.add(appt)

        # Prescriptions → AVAILABLE_TO_PHARMACY
        rx_res = await db.execute(select(Prescription).filter(Prescription.visit_id == visit_id))
        for rx in rx_res.scalars().all():
            rx.status = "AVAILABLE_TO_PHARMACY"
            db.add(rx)

        # Lab orders → VISIBLE_TO_LAB
        lo_res = await db.execute(select(LabOrder).filter(LabOrder.visit_id == visit_id))
        for lo in lo_res.scalars().all():
            lo.status = "VISIBLE_TO_LAB"
            db.add(lo)

        # Radiology orders → VISIBLE_TO_RADIOLOGY
        ro_res = await db.execute(select(RadiologyOrder).filter(RadiologyOrder.visit_id == visit_id))
        for ro in ro_res.scalars().all():
            ro.status = "VISIBLE_TO_RADIOLOGY"
            db.add(ro)

        # Auto billing item
        bi = BillingItem(
            visit_id=visit_id, tenant_id=current_user.tenant_id,
            description="Consultation Fee", amount=100.0,
        )
        db.add(bi)

        _audit(db, visit_id=visit_id, action="CONSULTATION_COMPLETED",
               actor_id=current_user.id, patient_id=visit.patient_id,
               tenant_id=current_user.tenant_id, appointment_id=visit.appointment_id,
               ip=_ip(request))

        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to complete consultation: {exc}")

    await db.refresh(visit)
    return await _build_chart(db, visit)


# ── POST /visits/{visit_id}/amend ─────────────────────────────────────────────
@router.post("/{visit_id}/amend")
async def amend_medical_record(
    visit_id: int, body: AmendmentRequest, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    mr_res = await db.execute(select(MedicalRecord).filter(MedicalRecord.visit_id == visit_id))
    mr = mr_res.scalars().first()
    if not mr or not mr.is_immutable:
        raise HTTPException(status_code=409, detail="Amendment only applies to completed records.")
    if current_user.role_id not in (1, 2, 4):
        raise HTTPException(status_code=403, detail="Not authorised to amend.")

    snapshot = {
        "visit_id": visit_id,
        "is_immutable": mr.is_immutable,
        "signed_by": mr.signed_by,
        "signed_at": mr.signed_at.isoformat() if mr.signed_at else None,
        "snapshot_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.clinical_note_id and body.new_content:
        note_res = await db.execute(
            select(ClinicalNote).filter(
                ClinicalNote.id == body.clinical_note_id,
                ClinicalNote.visit_id == visit_id,
            )
        )
        note = note_res.scalars().first()
        if note:
            snapshot["prior_note_content"] = note.content
            note.content = body.new_content
            db.add(note)

    version = MedicalRecordVersion(
        medical_record_id=mr.id,
        snapshot=json.dumps(snapshot),
        amended_by=current_user.id,
        amendment_reason=body.amendment_reason,
    )
    db.add(version)
    _audit(db, visit_id=visit_id, action="RECORD_AMENDED",
           actor_id=current_user.id, patient_id=visit.patient_id,
           tenant_id=current_user.tenant_id, ip=_ip(request),
           meta={"reason": body.amendment_reason})
    await db.commit()
    return {"message": "Amendment recorded.", "version_id": version.id}


# ── GET /visits/{visit_id}/audit-log ─────────────────────────────────────────
@router.get("/{visit_id}/audit-log", response_model=List[AuditLogOut])
async def get_audit_log(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    visit = await _get_visit_or_404(db, visit_id, current_user.tenant_id)
    if current_user.role_id not in (1, 2) and visit.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")
    res = await db.execute(
        select(VisitAuditLog)
        .filter(VisitAuditLog.visit_id == visit_id)
        .order_by(VisitAuditLog.created_at)
    )
    return res.scalars().all()


# ── GET /visits/{visit_id}/check-start ───────────────────────────────────────
@router.get("/{appointment_id}/can-start")
async def can_start_consultation(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Check whether the Start Consultation button should be enabled."""
    appt_res = await db.execute(
        select(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = appt_res.scalars().first()
    if not appt:
        return {"can_start": False, "reason": "Appointment not found."}

    if appt.status == "cancelled":
        return {"can_start": False, "reason": "Appointment is cancelled.", "hide": True}
    if appt.status == "completed":
        return {"can_start": False, "reason": "Appointment is completed.", "hide": True}
    if appt.status == "scheduled":
        return {"can_start": False, "reason": "Awaiting check-in."}

    existing_res = await db.execute(
        select(Visit).filter(
            Visit.appointment_id == appointment_id,
            Visit.status == "IN_PROGRESS",
        )
    )
    existing = existing_res.scalars().first()
    if existing:
        return {"can_start": False, "reason": "Consultation in progress.",
                "visit_id": existing.id}

    if appt.status == "checked_in":
        return {"can_start": True, "reason": "Ready to start."}

    return {"can_start": False, "reason": f"Unexpected status: {appt.status}."}
