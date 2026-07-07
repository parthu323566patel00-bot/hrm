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
    Query, UploadFile, status,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.auth_utils import has_permission
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
    """Return doctors (role_id=4) assigned to the given department."""
    rows = await db.execute(
        select(User).join(
            DoctorDepartment, DoctorDepartment.doctor_id == User.id
        ).filter(
            DoctorDepartment.department_id == department_id,
            User.role_id == 4,
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
            User.role_id == 4,
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
            User.role_id == 4,
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

    # Save files
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
    patient_name and department_name.
    filter values:
      today    – only today
      upcoming – today + future (default)
      past     – before today
      all      – everything
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
    # "all" — no date filter

    q = q.order_by(Appointment.appointment_date, Appointment.time_slot)
    res = await db.execute(q)
    appts = res.scalars().all()

    result = []
    for a in appts:
        pat_res = await db.execute(select(Patient).filter(Patient.id == a.patient_id))
        pat = pat_res.scalars().first()

        dept_name = None
        if a.department_id:
            dept_res = await db.execute(select(Department).filter(Department.id == a.department_id))
            dept = dept_res.scalars().first()
            dept_name = dept.name if dept else None

        result.append({
            "id": a.id,
            "patient_id": a.patient_id,
            "patient_name": pat.name if pat else "Unknown",
            "doctor_id": a.doctor_id,
            "department_name": dept_name,
            "appointment_date": a.appointment_date,
            "time_slot": a.time_slot,
            "notes": a.notes,
            "status": a.status,
            "created_at": a.created_at,
        })
    return result



@router.get("/today")
async def list_today_appointments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Return today's appointments for the tenant, enriched with
    patient_name, doctor_name and department_name for display.
    Ordered by time_slot.
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

    result = []
    for a in appts:
        # Patient name
        pat_res = await db.execute(select(Patient).filter(Patient.id == a.patient_id))
        pat = pat_res.scalars().first()

        # Doctor name
        doc_res = await db.execute(select(User).filter(User.id == a.doctor_id))
        doc = doc_res.scalars().first()

        # Department name
        dept_name = None
        if a.department_id:
            dept_res = await db.execute(select(Department).filter(Department.id == a.department_id))
            dept = dept_res.scalars().first()
            dept_name = dept.name if dept else None

        result.append({
            "id": a.id,
            "patient_id": a.patient_id,
            "patient_name": pat.name if pat else "Unknown",
            "doctor_id": a.doctor_id,
            "doctor_name": doc.full_name or doc.email if doc else "Unknown",
            "department_name": dept_name,
            "appointment_date": a.appointment_date,
            "time_slot": a.time_slot,
            "notes": a.notes,
            "status": a.status,
            "created_at": a.created_at,
        })
    return result



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
