# Design Document — Patient Visit & Medical Record Lifecycle

## Overview

This feature implements the full clinical encounter lifecycle on top of the existing
Appointment model. A **Visit** (Encounter) is the central parent entity. Every piece
of clinical data created during a consultation — Vitals, Clinical Notes, Diagnosis,
Prescriptions, Lab Orders, Radiology Orders, Attachments, Billing Items, and Audit
Logs — belongs to a Visit, never directly to a Patient.

---

## Architecture

### Tech stack (unchanged)
- **Backend**: FastAPI + SQLAlchemy (async) + SQLite (aiosqlite)
- **Frontend**: React + Vite + Lucide icons
- **Auth**: JWT bearer tokens, RSA-encrypted passwords, RBAC via `has_permission()`

### New layers introduced
```
app/
  models/
    visit.py
    medical_record.py
    medical_record_version.py
    vitals.py
    clinical_note.py
    diagnosis.py
    prescription.py
    lab_order.py
    radiology_order.py
    visit_attachment.py
    billing_item.py
    visit_audit_log.py
  schemas/
    visit.py
    medical_record.py
    clinical_note.py
    vitals.py
    diagnosis.py
    prescription.py
    lab_order.py
    radiology_order.py
  api/v1/endpoints/
    visits.py
frontend/src/
  features/doctor/
    PatientChart.jsx
    ConsultationView.jsx
    VitalsForm.jsx
    ClinicalNotesForm.jsx
    DiagnosisForm.jsx
    PrescriptionForm.jsx
    LabOrderForm.jsx
    RadiologyOrderForm.jsx
    PatientHistory.jsx
  services/
    visitService.js
```

---

## Data Models

### Visit
```
visits
  id              INTEGER PK
  tenant_id       VARCHAR(50) FK → tenants.id  NOT NULL
  appointment_id  INTEGER FK → appointments.id  NOT NULL UNIQUE
  patient_id      INTEGER FK → patients.id      NOT NULL
  doctor_id       INTEGER FK → users.id          NOT NULL
  status          VARCHAR(20)  DEFAULT 'IN_PROGRESS'   -- IN_PROGRESS | COMPLETED
  started_at      DATETIME     NOT NULL
  completed_at    DATETIME     NULL
  created_at      DATETIME
```

### MedicalRecord
```
medical_records
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL UNIQUE
  is_immutable    BOOLEAN DEFAULT 0
  signed_by       INTEGER FK → users.id  NULL
  signed_at       DATETIME NULL
  signature_hash  VARCHAR(512) NULL
  created_at      DATETIME
  updated_at      DATETIME
```

### MedicalRecordVersion (amendment history)
```
medical_record_versions
  id              INTEGER PK
  medical_record_id INTEGER FK → medical_records.id  NOT NULL
  snapshot        TEXT  NOT NULL  -- JSON snapshot of prior state
  amended_by      INTEGER FK → users.id  NOT NULL
  amendment_reason VARCHAR(500) NOT NULL
  amended_at      DATETIME NOT NULL
```

### Vitals
```
vitals
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL
  systolic_bp     INTEGER NULL    -- mmHg
  diastolic_bp    INTEGER NULL    -- mmHg
  heart_rate      INTEGER NULL    -- bpm
  temperature     FLOAT NULL      -- °C
  spo2            FLOAT NULL      -- %
  respiratory_rate INTEGER NULL   -- breaths/min
  weight_kg       FLOAT NULL
  height_cm       FLOAT NULL
  recorded_by     INTEGER FK → users.id  NOT NULL
  recorded_at     DATETIME NOT NULL
```

### ClinicalNote
```
clinical_notes
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL
  content         TEXT NOT NULL
  written_by      INTEGER FK → users.id  NOT NULL
  written_at      DATETIME NOT NULL
  updated_at      DATETIME
```

### Diagnosis
```
diagnoses
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL
  icd_code        VARCHAR(20) NULL
  description     TEXT NOT NULL
  severity        VARCHAR(20) DEFAULT 'moderate'  -- mild|moderate|severe
  diagnosed_by    INTEGER FK → users.id  NOT NULL
  diagnosed_at    DATETIME NOT NULL
```

### Prescription
```
prescriptions
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL
  medication_name VARCHAR(200) NOT NULL
  dosage          VARCHAR(100) NOT NULL
  frequency       VARCHAR(100) NOT NULL
  duration        VARCHAR(100) NOT NULL
  route           VARCHAR(50) NOT NULL   -- oral|IV|IM|topical|etc
  instructions    TEXT NULL
  status          VARCHAR(30) DEFAULT 'DRAFT'  -- DRAFT|AVAILABLE_TO_PHARMACY
  prescribed_by   INTEGER FK → users.id  NOT NULL
  prescribed_at   DATETIME NOT NULL
```

### LabOrder
```
lab_orders
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL
  test_name       VARCHAR(200) NOT NULL
  clinical_notes  TEXT NULL
  status          VARCHAR(30) DEFAULT 'PENDING'  -- PENDING|VISIBLE_TO_LAB|IN_PROGRESS|COMPLETED
  ordered_by      INTEGER FK → users.id  NOT NULL
  ordered_at      DATETIME NOT NULL
```

### RadiologyOrder
```
radiology_orders
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL
  imaging_type    VARCHAR(100) NOT NULL  -- X-Ray|MRI|CT|Ultrasound|etc
  body_region     VARCHAR(100) NOT NULL
  clinical_indication TEXT NOT NULL
  status          VARCHAR(30) DEFAULT 'PENDING'  -- PENDING|VISIBLE_TO_RADIOLOGY|IN_PROGRESS|COMPLETED
  ordered_by      INTEGER FK → users.id  NOT NULL
  ordered_at      DATETIME NOT NULL
```

### VisitAttachment
```
visit_attachments
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL
  original_filename VARCHAR(255) NOT NULL
  stored_filename VARCHAR(255) NOT NULL UNIQUE
  file_size       INTEGER NOT NULL
  mime_type       VARCHAR(100) NOT NULL
  uploaded_by     INTEGER FK → users.id  NOT NULL
  uploaded_at     DATETIME NOT NULL
```

### BillingItem
```
billing_items
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL
  tenant_id       VARCHAR(50) FK → tenants.id  NOT NULL
  description     VARCHAR(300) NOT NULL
  amount          FLOAT NOT NULL DEFAULT 0.0
  currency        VARCHAR(10) DEFAULT 'USD'
  status          VARCHAR(20) DEFAULT 'PENDING'  -- PENDING|INVOICED|PAID
  created_at      DATETIME NOT NULL
```

### VisitAuditLog
```
visit_audit_logs
  id              INTEGER PK
  visit_id        INTEGER FK → visits.id  NOT NULL
  tenant_id       VARCHAR(50) NOT NULL
  action          VARCHAR(50) NOT NULL
  actor_id        INTEGER FK → users.id  NOT NULL
  patient_id      INTEGER NOT NULL
  appointment_id  INTEGER NULL
  ip_address      VARCHAR(45) NULL
  metadata        TEXT NULL  -- JSON for extra context
  created_at      DATETIME NOT NULL
```

---

## API Endpoints

All endpoints are mounted at `/api/v1/visits`.

### Start Consultation (atomic)
```
POST /visits/start
Body: { appointment_id: int }
Response: { visit_id, medical_record_id, status }
Permission: Doctor assigned to appointment
Guards: appointment.status == checked_in, no active visit for appointment
```

### Get Visit + Chart
```
GET /visits/{visit_id}
Response: full visit with medical_record, vitals, notes, diagnoses,
          prescriptions, lab_orders, radiology_orders
Permission: assigned doctor, hospital admin, super admin
```

### Get Patient History
```
GET /visits/patient/{patient_id}
Response: all completed visits ordered by started_at desc
Permission: doctor (any), hospital admin
```

### Vitals
```
POST /visits/{visit_id}/vitals
GET  /visits/{visit_id}/vitals
```

### Clinical Notes
```
POST   /visits/{visit_id}/notes
PUT    /visits/{visit_id}/notes/{note_id}
GET    /visits/{visit_id}/notes
```

### Diagnosis
```
POST   /visits/{visit_id}/diagnoses
PUT    /visits/{visit_id}/diagnoses/{diagnosis_id}
GET    /visits/{visit_id}/diagnoses
```

### Prescriptions
```
POST   /visits/{visit_id}/prescriptions
GET    /visits/{visit_id}/prescriptions
```

### Lab Orders
```
POST   /visits/{visit_id}/lab-orders
GET    /visits/{visit_id}/lab-orders
```

### Radiology Orders
```
POST   /visits/{visit_id}/radiology-orders
GET    /visits/{visit_id}/radiology-orders
```

### Attachments
```
POST   /visits/{visit_id}/attachments   (multipart, max 10MB)
GET    /visits/{visit_id}/attachments
```

### Sign Consultation
```
POST /visits/{visit_id}/sign
Permission: assigned doctor only
Guards: visit IN_PROGRESS, medical_record not already signed
```

### Complete Consultation (atomic)
```
POST /visits/{visit_id}/complete
Permission: assigned doctor only
Guards: medical_record.signature_hash is not null
```

### Audit Log
```
GET /visits/{visit_id}/audit-log
Permission: visit:audit_read
```

### Amendment
```
POST /visits/{visit_id}/amend
Body: { field_updates, amendment_reason }
Permission: assigned doctor or hospital admin
Guards: medical_record.is_immutable == true → creates version history
```

---

## State Machine

### Appointment statuses (existing + updated)
```
scheduled → checked_in → in_progress → completed
                       → cancelled
```

### Visit statuses (new)
```
IN_PROGRESS → COMPLETED
```

### Consultation button rules
| Appt Status   | Visit exists? | Button State               |
|---------------|--------------|----------------------------|
| scheduled     | No           | Disabled "Awaiting Check-In"|
| checked_in    | No           | **Enabled "Start Consultation"** |
| checked_in    | IN_PROGRESS  | Disabled "Consultation Active" |
| in_progress   | IN_PROGRESS  | Disabled "Consultation Active" |
| completed     | COMPLETED    | Hidden                      |
| cancelled     | —            | Hidden                      |

---

## Start Consultation — Atomic Transaction Detail

```python
async with db.begin():                     # single transaction
    1. Verify appointment.status == checked_in
    2. Verify no IN_PROGRESS visit for appointment_id
    3. Verify current_user.id == appointment.doctor_id
    4. INSERT Visit(status=IN_PROGRESS, started_at=now)
    5. INSERT MedicalRecord(visit_id=visit.id)
    6. INSERT VisitAuditLog(action=VISIT_STARTED, ...)
    7. UPDATE Appointment.status = in_progress
    # commit or rollback atomically
```

## Complete Consultation — Atomic Transaction Detail

```python
async with db.begin():
    1. Verify visit.status == IN_PROGRESS
    2. Verify medical_record.signature_hash is not None
    3. Verify current_user.id == visit.doctor_id
    4. UPDATE Visit.status = COMPLETED, completed_at = now
    5. UPDATE MedicalRecord.is_immutable = True
    6. UPDATE Appointment.status = completed
    7. UPDATE all Prescriptions → status = AVAILABLE_TO_PHARMACY
    8. UPDATE all LabOrders    → status = VISIBLE_TO_LAB
    9. UPDATE all RadiologyOrders → status = VISIBLE_TO_RADIOLOGY
   10. INSERT BillingItem(description="Consultation Fee", ...)
   11. INSERT VisitAuditLog(action=CONSULTATION_COMPLETED, ...)
    # commit or rollback atomically
```

---

## Frontend Architecture

### Doctor Queue changes
- Each `checked_in` appointment row gets an **"Open Chart"** button
- Clicking opens `PatientChart` full-screen modal/page

### PatientChart layout
```
┌─────────────────────────────────────────────────────┐
│  Patient: John Smith  Age: 35  Blood: A+  Allergies  │
│  Appointment: 14:00 · General Surgery                │
├──────────────┬──────────────────────────────────────┤
│  Left panel  │  Right panel                         │
│  ─────────── │  ─────────────────────────────────── │
│  Patient     │  [Start Consultation] button          │
│  History     │  ─────────────────────────────────── │
│  (prior      │  Tabs: Vitals | Notes | Diagnosis |   │
│  visits)     │        Rx | Lab | Radiology | Files   │
│              │  ─────────────────────────────────── │
│              │  [Sign Consultation] [Complete]        │
└──────────────┴──────────────────────────────────────┘
```

### ConsultationView tabs (active only during IN_PROGRESS)
1. **Vitals** — `VitalsForm`
2. **Clinical Notes** — rich textarea, `ClinicalNotesForm`
3. **Diagnosis** — ICD code + description, `DiagnosisForm`
4. **Prescriptions** — medication list, `PrescriptionForm`
5. **Lab Orders** — `LabOrderForm`
6. **Radiology** — `RadiologyOrderForm`
7. **Files** — drag-drop upload

---

## Security

- All visit sub-document writes check `visit.status == IN_PROGRESS` server-side
- Completed records return `is_immutable: true`; frontend disables all edit controls
- Amendment requests go through a separate `/amend` endpoint that snapshots prior state
- Digital signature uses `hashlib.sha256(json_record + doctor_id + timestamp)`
- Audit logs append-only enforced at DB level (no UPDATE/DELETE on `visit_audit_logs`)
- Tenant isolation enforced on every query: `WHERE tenant_id = current_user.tenant_id`
