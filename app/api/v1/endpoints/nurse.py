"""
app/api/v1/endpoints/nurse.py
--------------------------------
Nurse workflow endpoints — all require role_id = 3 (Nurse).

Workflow:
  1. GET  /nurse/queue                                — today's checked-in + in-progress patients
  2. POST /nurse/appointments/{id}/pre-vitals         — record vitals BEFORE doctor starts (checked_in)
  3. GET  /nurse/visits/{visit_id}                    — care plan (notes, orders, vitals history)
  4. POST /nurse/visits/{visit_id}/vitals             — record vitals during active consultation
  5. POST /nurse/visits/{visit_id}/procedure          — log a nursing procedure
  6. POST /nurse/visits/{visit_id}/discharge-checklist — prepare discharge

Pre-vitals (step 2) are stored with visit_id=NULL and appointment_id set.
When the doctor starts the consultation, the start_consultation endpoint
automatically promotes those pre-vitals to the new visit.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.auth_utils import has_permission
from app.core.constants.roles import RoleId
from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.clinical_note import ClinicalNote
from app.models.department import Department
from app.models.diagnosis import Diagnosis
from app.models.lab_order import LabOrder
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.radiology_order import RadiologyOrder
from app.models.user import User
from app.models.visit import Visit
from app.models.visit_audit_log import VisitAuditLog
from app.models.vitals import Vitals
from app.schemas.visit import VitalsCreate, VitalsOut

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Permission guard ──────────────────────────────────────────────────────────

def _require_nurse(user: User) -> None:
    """Raises 403 if caller is not a Nurse (role_id=5)."""
    if user.role_id != RoleId.NURSE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is restricted to Nurses.",
        )


def _ip(request: Request) -> Optional[str]:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (
        request.client.host if request.client else None
    )


async def _audit(
    db: AsyncSession,
    *,
    visit_id: int,
    action: str,
    actor_id: int,
    patient_id: int,
    tenant_id: str,
    ip: Optional[str] = None,
    meta: Optional[dict] = None,
) -> None:
    log = VisitAuditLog(
        visit_id=visit_id,
        tenant_id=tenant_id,
        action=action,
        actor_id=actor_id,
        patient_id=patient_id,
        ip_address=ip,
        metadata_json=json.dumps(meta) if meta else None,
    )
    db.add(log)


# ── Pydantic schemas (nurse-specific) ────────────────────────────────────────

class NursePatientRow(BaseModel):
    appointment_id: int
    visit_id: Optional[int]
    patient_id: int
    patient_name: str
    patient_age: int
    patient_gender: str
    patient_allergies: Optional[str]
    blood_group: Optional[str]
    appointment_time: str
    department_name: Optional[str]
    doctor_name: Optional[str]
    appt_status: str
    visit_status: Optional[str]
    latest_vitals: Optional[VitalsOut]

    class Config:
        from_attributes = True


class CarePlanOut(BaseModel):
    visit_id: int
    patient_id: int
    patient_name: str
    doctor_name: Optional[str]
    visit_status: str
    notes: List[dict]
    diagnoses: List[dict]
    prescriptions: List[dict]
    lab_orders: List[dict]
    radiology_orders: List[dict]
    vitals_history: List[VitalsOut]


class ProcedureCreate(BaseModel):
    description: str           # e.g. "IV drip inserted", "Blood sample collected"
    observation: Optional[str] = None


class DischargeChecklistCreate(BaseModel):
    checklist_notes: Optional[str] = None
    bed_number: Optional[str] = None


# ── GET /nurse/queue ──────────────────────────────────────────────────────────

@router.get("/queue", response_model=List[NursePatientRow])
async def nurse_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Today's checked-in and in-progress patients for the nurse's tenant.
    Single bulk query — no N+1.
    """
    _require_nurse(current_user)

    today = datetime.utcnow().strftime("%Y-%m-%d")

    # Fetch today's actionable appointments in one query
    appt_res = await db.execute(
        select(Appointment).filter(
            Appointment.tenant_id == current_user.tenant_id,
            Appointment.appointment_date == today,
            Appointment.status.in_(["checked_in", "in_progress"]),
        ).order_by(Appointment.time_slot)
    )
    appointments = appt_res.scalars().all()
    if not appointments:
        return []

    # Bulk-fetch related entities
    patient_ids = list({a.patient_id for a in appointments})
    doctor_ids  = list({a.doctor_id  for a in appointments})
    dept_ids    = list({a.department_id for a in appointments if a.department_id})
    appt_ids    = [a.id for a in appointments]

    pat_map  = {p.id: p for p in (await db.execute(
        select(Patient).filter(Patient.id.in_(patient_ids))
    )).scalars()}
    doc_map  = {u.id: u for u in (await db.execute(
        select(User).filter(User.id.in_(doctor_ids))
    )).scalars()}
    dept_map = {}
    if dept_ids:
        dept_map = {d.id: d for d in (await db.execute(
            select(Department).filter(Department.id.in_(dept_ids))
        )).scalars()}

    # Fetch visits for these appointments
    visit_res = await db.execute(
        select(Visit).filter(Visit.appointment_id.in_(appt_ids))
    )
    visit_by_appt = {v.appointment_id: v for v in visit_res.scalars().all()}

    # Fetch latest vitals per visit (one query)
    visit_ids = [v.id for v in visit_by_appt.values()]
    latest_vitals: dict[int, Vitals] = {}
    if visit_ids:
        vitals_res = await db.execute(
            select(Vitals)
            .filter(Vitals.visit_id.in_(visit_ids))
            .order_by(Vitals.recorded_at.desc())
        )
        for v in vitals_res.scalars().all():
            if v.visit_id not in latest_vitals:
                latest_vitals[v.visit_id] = v

    rows = []
    for appt in appointments:
        pat   = pat_map.get(appt.patient_id)
        doc   = doc_map.get(appt.doctor_id)
        dept  = dept_map.get(appt.department_id)
        visit = visit_by_appt.get(appt.id)
        vitals = latest_vitals.get(visit.id) if visit else None

        rows.append(NursePatientRow(
            appointment_id   = appt.id,
            visit_id         = visit.id if visit else None,
            patient_id       = appt.patient_id,
            patient_name     = pat.name if pat else "Unknown",
            patient_age      = pat.age if pat else 0,
            patient_gender   = pat.gender if pat else "",
            patient_allergies= pat.allergies if pat else None,
            blood_group      = pat.blood_group if pat else None,
            appointment_time = appt.time_slot,
            department_name  = dept.name if dept else None,
            doctor_name      = (doc.full_name or doc.email) if doc else None,
            appt_status      = appt.status,
            visit_status     = visit.status if visit else None,
            latest_vitals    = VitalsOut.model_validate(vitals) if vitals else None,
        ))
    return rows


# ── POST /nurse/appointments/{appointment_id}/pre-vitals ─────────────────────

@router.post("/appointments/{appointment_id}/pre-vitals",
             response_model=VitalsOut, status_code=status.HTTP_201_CREATED)
async def record_pre_vitals(
    appointment_id: int,
    body: VitalsCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Record vitals BEFORE the doctor starts the consultation.
    Works when appointment status = checked_in (no visit exists yet).
    The vitals are stored with visit_id=NULL and appointment_id set.
    When the doctor starts the consultation, start_consultation()
    automatically promotes these pre-vitals to the new visit.
    """
    _require_nurse(current_user)

    appt_res = await db.execute(
        select(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = appt_res.scalars().first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if appt.status not in ("checked_in", "in_progress"):
        raise HTTPException(
            status_code=409,
            detail=f"Pre-vitals can only be recorded for checked-in appointments. Current: {appt.status}",
        )
    if not any([body.systolic_bp, body.diastolic_bp, body.heart_rate, body.temperature,
                body.spo2, body.respiratory_rate, body.weight_kg, body.height_cm]):
        raise HTTPException(status_code=422, detail="At least one vitals field is required.")

    # If a visit already exists, attach directly to it
    visit_res = await db.execute(
        select(Visit).filter(Visit.appointment_id == appointment_id)
    )
    existing_visit = visit_res.scalars().first()
    visit_id = existing_visit.id if existing_visit else None

    v = Vitals(
        visit_id=visit_id,
        appointment_id=appointment_id,
        recorded_by=current_user.id,
        **body.model_dump(),
    )
    db.add(v)

    # Audit — use visit audit log if visit exists, else skip (no visit_id yet)
    if visit_id:
        await _audit(db, visit_id=visit_id, action="PRE_VITALS_RECORDED",
                     actor_id=current_user.id, patient_id=appt.patient_id,
                     tenant_id=current_user.tenant_id, ip=_ip(request))

    try:
        await db.commit()
        await db.refresh(v)
        return v
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save pre-vitals: {exc}")


# ── GET /nurse/appointments/{appointment_id}/pre-vitals ───────────────────────

@router.get("/appointments/{appointment_id}/pre-vitals",
            response_model=List[VitalsOut])
async def get_pre_vitals(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return all pre-vitals recorded for a checked-in appointment."""
    _require_nurse(current_user)
    res = await db.execute(
        select(Vitals).filter(Vitals.appointment_id == appointment_id)
        .order_by(Vitals.recorded_at.desc())
    )
    return res.scalars().all()


# ── GET /nurse/visits/{visit_id} — care plan ─────────────────────────────────
@router.get("/visits/{visit_id}", response_model=CarePlanOut)
async def get_care_plan(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Return the full care plan for a visit: doctor notes, orders, vitals history.
    Nurses are read-only here — only vitals and procedures are writable.
    """
    _require_nurse(current_user)

    visit_res = await db.execute(
        select(Visit).filter(
            Visit.id == visit_id,
            Visit.tenant_id == current_user.tenant_id,
        )
    )
    visit = visit_res.scalars().first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")

    # Bulk-fetch all care plan data (6 queries, no N+1)
    async def fetch_all(model, visit_id):
        r = await db.execute(select(model).filter(model.visit_id == visit_id))
        return r.scalars().all()

    pat_res = await db.execute(select(Patient).filter(Patient.id == visit.patient_id))
    pat = pat_res.scalars().first()
    doc_res = await db.execute(select(User).filter(User.id == visit.doctor_id))
    doc = doc_res.scalars().first()

    notes          = await fetch_all(ClinicalNote, visit_id)
    diagnoses      = await fetch_all(Diagnosis, visit_id)
    prescriptions  = await fetch_all(Prescription, visit_id)
    lab_orders     = await fetch_all(LabOrder, visit_id)
    radiology_orders = await fetch_all(RadiologyOrder, visit_id)
    vitals_history = await fetch_all(Vitals, visit_id)

    return CarePlanOut(
        visit_id      = visit.id,
        patient_id    = visit.patient_id,
        patient_name  = pat.name if pat else "Unknown",
        doctor_name   = (doc.full_name or doc.email) if doc else None,
        visit_status  = visit.status,
        notes         = [{"id": n.id, "content": n.content, "written_at": n.written_at.isoformat()} for n in notes],
        diagnoses     = [{"id": d.id, "description": d.description, "severity": d.severity, "icd_code": d.icd_code} for d in diagnoses],
        prescriptions = [{"id": p.id, "medication": p.medication_name, "dosage": p.dosage,
                          "frequency": p.frequency, "route": p.route, "status": p.status} for p in prescriptions],
        lab_orders    = [{"id": lo.id, "test": lo.test_name, "status": lo.status,
                          "notes": lo.clinical_notes, "ordered_at": lo.ordered_at.isoformat()} for lo in lab_orders],
        radiology_orders = [{"id": ro.id, "type": ro.imaging_type, "region": ro.body_region,
                              "indication": ro.clinical_indication, "status": ro.status} for ro in radiology_orders],
        vitals_history = [VitalsOut.model_validate(v) for v in vitals_history],
    )


# ── POST /nurse/visits/{visit_id}/vitals ──────────────────────────────────────

@router.post("/visits/{visit_id}/vitals",
             response_model=VitalsOut, status_code=status.HTTP_201_CREATED)
async def record_vitals(
    visit_id: int,
    body: VitalsCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Record vitals for a patient. Visit must be checked_in or in_progress."""
    _require_nurse(current_user)

    visit_res = await db.execute(
        select(Visit).filter(
            Visit.id == visit_id,
            Visit.tenant_id == current_user.tenant_id,
        )
    )
    visit = visit_res.scalars().first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    if visit.status not in ("IN_PROGRESS", "in_progress"):
        raise HTTPException(
            status_code=409,
            detail="Vitals can only be recorded for active visits.",
        )
    if not any([body.systolic_bp, body.diastolic_bp, body.heart_rate, body.temperature,
                body.spo2, body.respiratory_rate, body.weight_kg, body.height_cm]):
        raise HTTPException(
            status_code=422, detail="At least one vitals field is required.",
        )

    v = Vitals(visit_id=visit_id, recorded_by=current_user.id, **body.model_dump())
    db.add(v)
    await _audit(db, visit_id=visit_id, action="VITALS_RECORDED_BY_NURSE",
                 actor_id=current_user.id, patient_id=visit.patient_id,
                 tenant_id=current_user.tenant_id, ip=_ip(request))
    try:
        await db.commit()
        await db.refresh(v)
        return v
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save vitals: {exc}")


# ── POST /nurse/visits/{visit_id}/procedure ───────────────────────────────────

@router.post("/visits/{visit_id}/procedure", status_code=status.HTTP_201_CREATED)
async def log_procedure(
    visit_id: int,
    body: ProcedureCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Log a nursing procedure (IV insertion, blood draw, medication round, etc.).
    Stored as a ClinicalNote with a [NURSE PROCEDURE] prefix for visibility
    in the doctor's chart.
    """
    _require_nurse(current_user)

    visit_res = await db.execute(
        select(Visit).filter(
            Visit.id == visit_id,
            Visit.tenant_id == current_user.tenant_id,
        )
    )
    visit = visit_res.scalars().first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    if visit.status not in ("IN_PROGRESS", "in_progress"):
        raise HTTPException(status_code=409, detail="Visit is not active.")

    content = f"[NURSE PROCEDURE] {body.description}"
    if body.observation:
        content += f"\nObservation: {body.observation}"

    note = ClinicalNote(
        visit_id=visit_id,
        content=content,
        written_by=current_user.id,
    )
    db.add(note)
    await _audit(db, visit_id=visit_id, action="PROCEDURE_LOGGED",
                 actor_id=current_user.id, patient_id=visit.patient_id,
                 tenant_id=current_user.tenant_id, ip=_ip(request),
                 meta={"description": body.description})
    try:
        await db.commit()
        await db.refresh(note)
        return {
            "message": "Procedure logged.",
            "note_id": note.id,
            "content": note.content,
        }
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to log procedure: {exc}")


# ── POST /nurse/visits/{visit_id}/discharge-checklist ─────────────────────────

@router.post("/visits/{visit_id}/discharge-checklist")
async def prepare_discharge(
    visit_id: int,
    body: DischargeChecklistCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Nurse prepares discharge: logs discharge note + bed release.
    Only valid when visit status = COMPLETED (doctor has finished).
    """
    _require_nurse(current_user)

    visit_res = await db.execute(
        select(Visit).filter(
            Visit.id == visit_id,
            Visit.tenant_id == current_user.tenant_id,
        )
    )
    visit = visit_res.scalars().first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    if visit.status != "COMPLETED":
        raise HTTPException(
            status_code=409,
            detail="Discharge can only be prepared after the doctor completes the consultation.",
        )

    lines = ["[NURSE DISCHARGE CHECKLIST] Discharge preparation completed."]
    if body.bed_number:
        lines.append(f"Bed {body.bed_number} released.")
    if body.checklist_notes:
        lines.append(body.checklist_notes)

    note = ClinicalNote(
        visit_id=visit_id,
        content="\n".join(lines),
        written_by=current_user.id,
    )
    db.add(note)
    await _audit(db, visit_id=visit_id, action="DISCHARGE_PREPARED",
                 actor_id=current_user.id, patient_id=visit.patient_id,
                 tenant_id=current_user.tenant_id, ip=_ip(request),
                 meta={"bed": body.bed_number})
    try:
        await db.commit()
        return {"message": "Discharge checklist submitted.", "visit_id": visit_id}
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit discharge checklist: {exc}")
