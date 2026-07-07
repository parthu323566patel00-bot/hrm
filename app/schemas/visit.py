from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class StartConsultationRequest(BaseModel):
    appointment_id: int


class StartConsultationResponse(BaseModel):
    visit_id: int
    medical_record_id: int
    status: str
    started_at: datetime


# ── Sub-document schemas ───────────────────────────────────────────────────

class VitalsCreate(BaseModel):
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    spo2: Optional[float] = None
    respiratory_rate: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None


class VitalsOut(VitalsCreate):
    id: int
    visit_id: int
    recorded_by: int
    recorded_at: datetime

    class Config:
        from_attributes = True


class ClinicalNoteCreate(BaseModel):
    content: str


class ClinicalNoteOut(ClinicalNoteCreate):
    id: int
    visit_id: int
    written_by: int
    written_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DiagnosisCreate(BaseModel):
    icd_code: Optional[str] = None
    description: str
    severity: str = "moderate"


class DiagnosisOut(DiagnosisCreate):
    id: int
    visit_id: int
    diagnosed_by: int
    diagnosed_at: datetime

    class Config:
        from_attributes = True


class PrescriptionCreate(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    duration: str
    route: str
    instructions: Optional[str] = None


class PrescriptionOut(PrescriptionCreate):
    id: int
    visit_id: int
    status: str
    prescribed_by: int
    prescribed_at: datetime

    class Config:
        from_attributes = True


class LabOrderCreate(BaseModel):
    test_name: str
    clinical_notes: Optional[str] = None


class LabOrderOut(LabOrderCreate):
    id: int
    visit_id: int
    status: str
    ordered_by: int
    ordered_at: datetime

    class Config:
        from_attributes = True


class RadiologyOrderCreate(BaseModel):
    imaging_type: str
    body_region: str
    clinical_indication: str


class RadiologyOrderOut(RadiologyOrderCreate):
    id: int
    visit_id: int
    status: str
    ordered_by: int
    ordered_at: datetime

    class Config:
        from_attributes = True


class AttachmentOut(BaseModel):
    id: int
    visit_id: int
    original_filename: str
    file_size: int
    mime_type: str
    uploaded_by: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class BillingItemOut(BaseModel):
    id: int
    visit_id: int
    description: str
    amount: float
    currency: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: int
    visit_id: int
    action: str
    actor_id: int
    patient_id: int
    appointment_id: Optional[int]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MedicalRecordOut(BaseModel):
    id: int
    visit_id: int
    is_immutable: bool
    signed_by: Optional[int]
    signed_at: Optional[datetime]
    signature_hash: Optional[str]

    class Config:
        from_attributes = True


class AmendmentRequest(BaseModel):
    amendment_reason: str
    # Fields that can be amended (all optional — only provided ones are updated)
    clinical_note_id: Optional[int] = None
    new_content: Optional[str] = None


class VisitChartOut(BaseModel):
    id: int
    tenant_id: str
    appointment_id: int
    patient_id: int
    doctor_id: int
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    medical_record: Optional[MedicalRecordOut]
    vitals: List[VitalsOut] = []
    notes: List[ClinicalNoteOut] = []
    diagnoses: List[DiagnosisOut] = []
    prescriptions: List[PrescriptionOut] = []
    lab_orders: List[LabOrderOut] = []
    radiology_orders: List[RadiologyOrderOut] = []
    attachments: List[AttachmentOut] = []
    billing_items: List[BillingItemOut] = []

    class Config:
        from_attributes = True


class VisitSummaryOut(BaseModel):
    id: int
    appointment_id: int
    doctor_id: int
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    primary_diagnosis: Optional[str] = None

    class Config:
        from_attributes = True
