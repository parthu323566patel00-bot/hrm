"""
app/api/v1/endpoints/appointments.py
--------------------------------------
Appointment management:
  - List doctors by department (or all doctors)
  - Get available time slots for a doctor on a date
  - Book an appointment (with optional report file upload)
  - Upload additional reports to an existing appointment
  - List / get appointments
  - Update appointment status

File uploads: stored under  uploads/reports/<appointment_id>/
Max file size: 5 MB
Allowed types: PDF, DOCX, DOC, JPG, PNG, JPEG
"""

import os
import uuid
from datetime import date, datetime, timezone
from typing import Any, List, Optional

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException,
    Query, Request, UploadFile, status, BackgroundTasks,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.auth_utils import has_permission
from app.core.constants.roles import RoleId
from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.appointment_report import AppointmentReport
from app.models.department import Department
from app.models.doctor_department import DoctorDepartment
from app.models.patient import Patient
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCreate, AppointmentOut, AppointmentUpdate,
    DoctorOut, SlotInfo,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_FILE_SIZE = 5 * 1024 * 1024   # 5 MB

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "image/jpeg",
    "image/png",
    "image/jpg",
}

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png"}

# Slot template: 09:00 – 17:30, every 30 minutes
SLOT_TIMES: List[str] = []
for _h in range(9, 18):
    for _m in (0, 30):
        if _h == 17 and _m == 30:
            break
        SLOT_TIMES.append(f"{_h:02d}:{_m:02d}")

UPLOAD_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "uploads", "reports")


def _upload_dir(appointment_id: int) -> str:
    path = os.path.join(UPLOAD_ROOT, str(appointment_id))
    os.makedirs(path, exist_ok=True)
    return path


# ---------------------------------------------------------------------------
# GET /appointments/doctors — doctors in a specific department
# ---------------------------------------------------------------------------
@router.get("/doctors", response_model=List[DoctorOut])
async def list_doctors_by_department(
    department_id: int = Query(..., description="Department ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return doctors (role_id=2) assigned to the given department."""
    rows = await db.execute(
        select(User).join(
            DoctorDepartment, DoctorDepartment.doctor_id == User.id
        ).filter(
            DoctorDepartment.department_id == department_id,
            User.role_id == RoleId.DOCTOR,
            User.is_active == True,         # noqa: E712
            User.tenant_id == current_user.tenant_id,
        )
    )
    doctors = rows.scalars().all()
    return [
        DoctorOut(
            id=d.id,
            full_name=d.full_name,
            email=d.email,
            departments=[{"id": dep.id, "name": dep.name, "code": dep.code} for dep in d.departments],
        )
        for d in doctors
    ]


# ---------------------------------------------------------------------------
# GET /appointments/doctors/all — all doctors across all departments
# ---------------------------------------------------------------------------
@router.get("/doctors/all", response_model=List[DoctorOut])
async def list_all_doctors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return all active doctors in the tenant regardless of department."""
    rows = await db.execute(
        select(User).filter(
            User.role_id == RoleId.DOCTOR,
            User.is_active == True,         # noqa: E712
            User.tenant_id == current_user.tenant_id,
        )
    )
    doctors = rows.scalars().all()
    return [
        DoctorOut(
            id=d.id,
            full_name=d.full_name,
            email=d.email,
            departments=[{"id": dep.id, "name": dep.name, "code": dep.code} for dep in d.departments],
        )
        for d in doctors
    ]


# ---------------------------------------------------------------------------
# GET /appointments/slots — available time slots for a doctor on a date
# ---------------------------------------------------------------------------
@router.get("/slots", response_model=List[SlotInfo])
async def get_available_slots(
    doctor_id: int = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Return all 30-minute slots (09:00–17:30) with availability flag.
    A slot is unavailable if an active appointment already occupies it.
    """
    # Reject past dates
    try:
        chosen = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    today = datetime.now(timezone.utc).date()
    if chosen < today:
        raise HTTPException(status_code=400, detail="Cannot book appointments in the past.")

    # Fetch already-booked slots for this doctor+date (exclude cancelled)
    booked_res = await db.execute(
        select(Appointment.time_slot).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == date,
            Appointment.status != "cancelled",
        )
    )
    booked = {row[0] for row in booked_res.all()}

    # If the date is today, mark past slots as unavailable too
    now_time = datetime.now(timezone.utc)
    current_time_str = f"{now_time.hour:02d}:{now_time.minute:02d}" if chosen == today else None

    slots = []
    for t in SLOT_TIMES:
        unavailable = t in booked
        if current_time_str and t <= current_time_str:
            unavailable = True
        slots.append(SlotInfo(time=t, available=not unavailable))

    return slots


# ---------------------------------------------------------------------------
# POST /appointments/ — book an appointment
# ---------------------------------------------------------------------------
@router.post("/", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    background_tasks: BackgroundTasks,
    patient_id: int = Form(...),
    doctor_id: int = Form(...),
    department_id: Optional[int] = Form(None),
    appointment_date: str = Form(...),
    time_slot: str = Form(...),
    notes: Optional[str] = Form(None),
    reports: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Book an appointment. Optionally attach report files (PDF/DOCX/images, max 5 MB each).
    """
    if not await has_permission(db, current_user, "appointment:create"):
        raise HTTPException(status_code=403, detail="No permission to create appointments.")

    # Validate patient belongs to this tenant
    pat_res = await db.execute(
        select(Patient).filter(
            Patient.id == patient_id,
            Patient.tenant_id == current_user.tenant_id,
        )
    )
    if not pat_res.scalars().first():
        raise HTTPException(status_code=404, detail="Patient not found.")

    # Validate doctor exists and is active
    doc_res = await db.execute(
        select(User).filter(
            User.id == doctor_id,
            User.role_id == RoleId.DOCTOR,
            User.is_active == True,         # noqa: E712
            User.tenant_id == current_user.tenant_id,
        )
    )
    if not doc_res.scalars().first():
        raise HTTPException(status_code=404, detail="Doctor not found.")

    # Check slot is not already taken
    slot_res = await db.execute(
        select(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == appointment_date,
            Appointment.time_slot == time_slot,
            Appointment.status != "cancelled",
        )
    )
    if slot_res.scalars().first():
        raise HTTPException(status_code=409, detail="This time slot is already booked for the selected doctor.")

    # Validate date is not in the past
    try:
        chosen = datetime.strptime(appointment_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if chosen < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Cannot book appointments in the past.")

    # Validate files before writing anything
    file_contents = []
    for f in reports:
        if not f.filename:
            continue
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}': unsupported type. Allowed: PDF, DOCX, DOC, JPG, PNG.",
            )
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' exceeds the 5 MB limit.",
            )
        mime = f.content_type or "application/octet-stream"
        file_contents.append((f.filename, ext, mime, content))

    # Create appointment
    appt = Appointment(
        tenant_id=current_user.tenant_id,
        patient_id=patient_id,
        doctor_id=doctor_id,
        department_id=department_id,
        appointment_date=appointment_date,
        time_slot=time_slot,
        notes=notes,
        status="scheduled",
    )
    db.add(appt)
    try:
        await db.commit()
        await db.refresh(appt)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to book appointment: {str(exc)}")

    # Save files and register in document pipeline
    from app.documents.upload import document_upload_service
    from app.documents.services.processing import run_processing

    saved_reports = []
    upload_dir = _upload_dir(appt.id)
    for orig_name, ext, mime, content in file_contents:
        stored_name = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(upload_dir, stored_name)
        with open(dest, "wb") as fh:
            fh.write(content)
        report = AppointmentReport(
            appointment_id=appt.id,
            original_filename=orig_name,
            stored_filename=stored_name,
            file_size=len(content),
            mime_type=mime,
        )
        db.add(report)
        saved_reports.append(report)

        # Find matching UploadFile in the reports argument to pass to document upload service
        matching_file = next((f for f in reports if f.filename == orig_name), None)
        if matching_file:
            try:
                # Seek back to 0 in case the file was read
                await matching_file.seek(0)
                doc = await document_upload_service.upload(
                    db=db,
                    file=matching_file,
                    patient_id=patient_id,
                    tenant_id=current_user.tenant_id,
                    uploaded_by=current_user.id,
                    role_id=current_user.role_id or 0,
                    document_type="misc",
                )
                if doc and not doc.is_duplicate:
                    background_tasks.add_task(
                        run_processing, doc.id, current_user.id, current_user.tenant_id
                    )
            except Exception as e:
                # Log warning but do not abort appointment creation
                print(f"Warning: Failed to process receptionist upload in OCR pipeline: {e}")

    if saved_reports:
        try:
            await db.commit()
        except Exception as exc:
            await db.rollback()

    # Build response manually (avoid lazy-load issues)
    return AppointmentOut(
        id=appt.id,
        tenant_id=appt.tenant_id,
        patient_id=appt.patient_id,
        doctor_id=appt.doctor_id,
        department_id=appt.department_id,
        appointment_date=appt.appointment_date,
        time_slot=appt.time_slot,
        notes=appt.notes,
        status=appt.status,
        created_at=appt.created_at,
        updated_at=appt.updated_at,
        reports=[],
    )


# ---------------------------------------------------------------------------
# POST /appointments/{id}/reports — upload extra reports to existing appointment
# ---------------------------------------------------------------------------
@router.post("/{appointment_id}/reports")
async def upload_reports(
    appointment_id: int,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Attach additional report files to an existing appointment."""
    appt_res = await db.execute(
        select(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = appt_res.scalars().first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    upload_dir = _upload_dir(appointment_id)
    saved = []
    for f in files:
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}': unsupported type.",
            )
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' exceeds the 5 MB limit.",
            )
        stored_name = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(upload_dir, stored_name), "wb") as fh:
            fh.write(content)
        report = AppointmentReport(
            appointment_id=appointment_id,
            original_filename=f.filename,
            stored_filename=stored_name,
            file_size=len(content),
            mime_type=f.content_type or "application/octet-stream",
        )
        db.add(report)
        saved.append(report)

    await db.commit()
    return {"uploaded": len(saved)}


# ---------------------------------------------------------------------------
# GET /appointments/my — all appointments for the logged-in doctor (enriched)
# ---------------------------------------------------------------------------
@router.get("/my")
async def list_my_appointments(
    filter: Optional[str] = Query("upcoming", description="today | upcoming | past | all"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Return appointments assigned to the logged-in doctor, enriched with
    patient_name and department_name. Uses bulk lookups — no N+1 queries.
    """
    if not await has_permission(db, current_user, "appointment:view"):
        raise HTTPException(status_code=403, detail="No permission to view appointments.")

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    q = select(Appointment).filter(
        Appointment.tenant_id == current_user.tenant_id,
        Appointment.doctor_id == current_user.id,
    )
    if filter == "today":
        q = q.filter(Appointment.appointment_date == today_str)
    elif filter == "upcoming":
        q = q.filter(Appointment.appointment_date >= today_str)
    elif filter == "past":
        q = q.filter(Appointment.appointment_date < today_str)

    q = q.order_by(Appointment.appointment_date, Appointment.time_slot)
    res = await db.execute(q)
    appts = res.scalars().all()
    if not appts:
        return []

    # Bulk-fetch patients and departments in 2 queries max
    patient_ids = list({a.patient_id for a in appts})
    dept_ids    = list({a.department_id for a in appts if a.department_id})

    pat_map = {p.id: p for p in (await db.execute(select(Patient).filter(Patient.id.in_(patient_ids)))).scalars()}
    dept_map = {}
    if dept_ids:
        dept_map = {d.id: d for d in (await db.execute(select(Department).filter(Department.id.in_(dept_ids)))).scalars()}

    return [
        {
            "id":               a.id,
            "patient_id":       a.patient_id,
            "patient_name":     pat_map.get(a.patient_id, None) and pat_map[a.patient_id].name or "Unknown",
            "doctor_id":        a.doctor_id,
            "department_name":  dept_map.get(a.department_id, None) and dept_map[a.department_id].name or None,
            "appointment_date": a.appointment_date,
            "time_slot":        a.time_slot,
            "notes":            a.notes,
            "status":           a.status,
            "created_at":       a.created_at,
        }
        for a in appts
    ]



@router.get("/today")
async def list_today_appointments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Return today's appointments for the tenant, enriched with
    patient_name, doctor_name and department_name.
    Uses JOINs — no N+1 per-row queries.
    """
    if not await has_permission(db, current_user, "appointment:view"):
        raise HTTPException(status_code=403, detail="No permission to view appointments.")

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    res = await db.execute(
        select(Appointment).filter(
            Appointment.tenant_id == current_user.tenant_id,
            Appointment.appointment_date == today_str,
        ).order_by(Appointment.time_slot)
    )
    appts = res.scalars().all()
    if not appts:
        return []

    # Bulk-fetch all patients, doctors, departments needed — no per-row queries
    patient_ids    = list({a.patient_id for a in appts})
    doctor_ids     = list({a.doctor_id  for a in appts})
    dept_ids       = list({a.department_id for a in appts if a.department_id})

    pat_map  = {p.id: p for p in (await db.execute(select(Patient).filter(Patient.id.in_(patient_ids)))).scalars()}
    doc_map  = {u.id: u for u in (await db.execute(select(User).filter(User.id.in_(doctor_ids)))).scalars()}
    dept_map = {}
    if dept_ids:
        dept_map = {d.id: d for d in (await db.execute(select(Department).filter(Department.id.in_(dept_ids)))).scalars()}

    return [
        {
            "id":               a.id,
            "patient_id":       a.patient_id,
            "patient_name":     pat_map.get(a.patient_id, None) and pat_map[a.patient_id].name or "Unknown",
            "doctor_id":        a.doctor_id,
            "doctor_name":      (doc_map.get(a.doctor_id) and (doc_map[a.doctor_id].full_name or doc_map[a.doctor_id].email)) or "Unknown",
            "department_name":  dept_map.get(a.department_id, None) and dept_map[a.department_id].name or None,
            "appointment_date": a.appointment_date,
            "time_slot":        a.time_slot,
            "notes":            a.notes,
            "status":           a.status,
            "created_at":       a.created_at,
        }
        for a in appts
    ]



@router.get("/", response_model=List[AppointmentOut])
async def list_appointments(
    patient_id: Optional[int] = Query(None),
    doctor_id: Optional[int] = Query(None),
    appt_date: Optional[str] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if not await has_permission(db, current_user, "appointment:view"):
        raise HTTPException(status_code=403, detail="No permission to view appointments.")

    q = select(Appointment).filter(Appointment.tenant_id == current_user.tenant_id)
    if patient_id:
        q = q.filter(Appointment.patient_id == patient_id)
    if doctor_id:
        q = q.filter(Appointment.doctor_id == doctor_id)
    if appt_date:
        q = q.filter(Appointment.appointment_date == appt_date)

    q = q.order_by(Appointment.appointment_date, Appointment.time_slot)
    res = await db.execute(q)
    appts = res.scalars().all()

    result = []
    for a in appts:
        rpt_res = await db.execute(
            select(AppointmentReport).filter(AppointmentReport.appointment_id == a.id)
        )
        rpts = rpt_res.scalars().all()
        result.append(AppointmentOut(
            id=a.id, tenant_id=a.tenant_id, patient_id=a.patient_id,
            doctor_id=a.doctor_id, department_id=a.department_id,
            appointment_date=a.appointment_date, time_slot=a.time_slot,
            notes=a.notes, status=a.status,
            created_at=a.created_at, updated_at=a.updated_at,
            reports=rpts,
        ))
    return result


# ---------------------------------------------------------------------------
# PATCH /appointments/{id} — update status / notes
# ---------------------------------------------------------------------------
@router.patch("/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(
    appointment_id: int,
    update_in: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if not await has_permission(db, current_user, "appointment:update"):
        raise HTTPException(status_code=403, detail="No permission to update appointments.")

    res = await db.execute(
        select(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = res.scalars().first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    for field, val in update_in.model_dump(exclude_unset=True).items():
        setattr(appt, field, val)

    db.add(appt)
    await db.commit()
    await db.refresh(appt)

    rpt_res = await db.execute(
        select(AppointmentReport).filter(AppointmentReport.appointment_id == appt.id)
    )
    return AppointmentOut(
        id=appt.id, tenant_id=appt.tenant_id, patient_id=appt.patient_id,
        doctor_id=appt.doctor_id, department_id=appt.department_id,
        appointment_date=appt.appointment_date, time_slot=appt.time_slot,
        notes=appt.notes, status=appt.status,
        created_at=appt.created_at, updated_at=appt.updated_at,
        reports=rpt_res.scalars().all(),
    )


# ---------------------------------------------------------------------------
# GET /appointments/{id}/reports/{report_id}/file — download report
# ---------------------------------------------------------------------------
@router.get("/{appointment_id}/reports/{report_id}/file")
async def download_appointment_report(
    appointment_id: int,
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Download/stream a receptionist-uploaded report from an appointment."""
    if current_user.role_id not in (
        RoleId.SUPER_ADMIN, RoleId.HOSPITAL_ADMIN, RoleId.RECEPTIONIST,
        RoleId.DOCTOR, RoleId.NURSE,
    ):
        raise HTTPException(status_code=403, detail="Access denied.")

    res = await db.execute(
        select(AppointmentReport).filter(
            AppointmentReport.id == report_id,
            AppointmentReport.appointment_id == appointment_id,
        )
    )
    report = res.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    appt_res = await db.execute(
        select(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_user.tenant_id,
        )
    )
    appt = appt_res.scalars().first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    file_path = os.path.join(_upload_dir(appointment_id), report.stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk.")

    return FileResponse(
        path=file_path,
        media_type=report.mime_type,
        filename=report.original_filename,
    )
