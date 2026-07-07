# Tasks — Patient Visit & Medical Record Lifecycle

## Task 1: Backend — Database Models
Create all new SQLAlchemy models and register them.
- [ ] `app/models/visit.py`
- [ ] `app/models/medical_record.py`
- [ ] `app/models/medical_record_version.py`
- [ ] `app/models/vitals.py`
- [ ] `app/models/clinical_note.py`
- [ ] `app/models/diagnosis.py`
- [ ] `app/models/prescription.py`
- [ ] `app/models/lab_order.py`
- [ ] `app/models/radiology_order.py`
- [ ] `app/models/visit_attachment.py`
- [ ] `app/models/billing_item.py`
- [ ] `app/models/visit_audit_log.py`
- [ ] Update `app/models/__init__.py`
- [ ] DB migration script

## Task 2: Backend — Pydantic Schemas
- [ ] `app/schemas/visit.py`
- [ ] `app/schemas/medical_record.py`

## Task 3: Backend — Visits Endpoint
- [ ] `POST /visits/start` — atomic start consultation
- [ ] `GET  /visits/{visit_id}` — full patient chart
- [ ] `GET  /visits/patient/{patient_id}` — patient history
- [ ] `POST /visits/{visit_id}/vitals`
- [ ] `POST /visits/{visit_id}/notes`
- [ ] `PUT  /visits/{visit_id}/notes/{note_id}`
- [ ] `POST /visits/{visit_id}/diagnoses`
- [ ] `POST /visits/{visit_id}/prescriptions`
- [ ] `POST /visits/{visit_id}/lab-orders`
- [ ] `POST /visits/{visit_id}/radiology-orders`
- [ ] `POST /visits/{visit_id}/attachments`
- [ ] `POST /visits/{visit_id}/sign`
- [ ] `POST /visits/{visit_id}/complete` — atomic completion
- [ ] `POST /visits/{visit_id}/amend`
- [ ] `GET  /visits/{visit_id}/audit-log`
- [ ] Register router in `api.py`

## Task 4: Frontend — visitService.js
- [ ] `startConsultation(token, appointmentId)`
- [ ] `getVisit(token, visitId)`
- [ ] `getPatientHistory(token, patientId)`
- [ ] `saveVitals / saveNote / saveDiagnosis / savePrescription`
- [ ] `saveLabOrder / saveRadiologyOrder`
- [ ] `signConsultation(token, visitId)`
- [ ] `completeConsultation(token, visitId)`

## Task 5: Frontend — PatientChart modal
- [ ] `PatientChart.jsx` — full-screen overlay, patient header, left/right panels
- [ ] `ConsultationView.jsx` — tabbed clinical workspace
- [ ] `VitalsForm.jsx`
- [ ] `ClinicalNotesForm.jsx`
- [ ] `DiagnosisForm.jsx`
- [ ] `PrescriptionForm.jsx`
- [ ] `LabOrderForm.jsx`
- [ ] `RadiologyOrderForm.jsx`
- [ ] `PatientHistory.jsx` — prior visits sidebar

## Task 6: Frontend — DoctorQueue integration
- [ ] Add "Open Chart" button to each `checked_in` appointment row
- [ ] Wire button to open `PatientChart` modal
- [ ] Start Consultation button state logic per design state machine
- [ ] Sign + Complete buttons with correct guard conditions
