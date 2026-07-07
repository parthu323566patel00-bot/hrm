# Requirements Document

## Introduction

This document specifies the requirements for the **Patient Visit & Medical Record Lifecycle** feature within **MediCore HMS** — a multi-tenant hospital management system. The feature extends the existing appointment workflow to support the full clinical encounter: from patient check-in through doctor consultation, clinical documentation, digital signing, and completion — where completion distributes the encounter data to Pharmacy, Laboratory, Radiology, and Billing in an immutable, auditable record.

The implementation builds on the existing FastAPI (Python) + React stack, extending the current Appointment model (statuses: `scheduled`, `checked_in`, `in_progress`, `completed`, `cancelled`) with new Visit, MedicalRecord, and supporting domain models.

---

## Glossary

- **Visit**: A clinical encounter (also called Encounter) created when a doctor starts a consultation. Maps 1-to-1 with a Medical Record. Status flows: `IN_PROGRESS` → `COMPLETED`.
- **Medical_Record**: The clinical document attached to exactly one Visit. Contains all clinical data captured during the consultation. Becomes immutable on Visit completion.
- **Audit_Log**: An append-only log entry recording every significant action on a Visit or Medical Record, including actor, timestamp, IP address, and action type.
- **Patient_Chart**: The doctor-facing view of a patient's clinical data for a specific Visit, including all sub-documents (Vitals, Clinical Notes, Diagnosis, Prescriptions, Lab Orders, Radiology Orders, Attachments, Billing Items).
- **Tenant**: A hospital organisation in the multi-tenant system. All data is isolated per Tenant.
- **Doctor**: A system user with `role_id = 4`.
- **Receptionist**: A system user with `role_id = 3`.
- **Pharmacist**: A system user with `role_id = 8`.
- **Lab_Technician**: A system user with `role_id = 6`.
- **Radiologist**: A system user with `role_id = 7`.
- **Billing_Clerk**: A system user with `role_id = 9`.
- **Start_Consultation_Button**: The UI control on the Patient Chart that triggers the atomic visit-creation transaction.
- **Sign_Consultation**: The action whereby a Doctor cryptographically signs the Medical Record before completing the consultation.
- **Patient_Timeline**: A chronological view of all Visits and key events for a given Patient.
- **Version_History**: The append-only record of amendments made to a completed Medical Record, preserving every prior state.
- **Atomic_Transaction**: A database operation that either fully succeeds or fully rolls back, leaving no partial state.
- **Doctor_Queue**: The existing doctor dashboard view that lists `checked_in` appointments.

---

## Requirements

---

### Requirement 1: Check-In Gate for Consultation

**User Story:** As a Doctor, I want the Start Consultation button to only become active when a patient is properly checked in, so that I cannot accidentally begin a consultation for a patient who has not arrived.

#### Acceptance Criteria

1. WHILE an Appointment has status `checked_in`, THE Start_Consultation_Button SHALL be visible and enabled in the Patient Chart for the assigned Doctor.
2. WHILE an Appointment has status `scheduled`, THE Start_Consultation_Button SHALL be visible but disabled, displaying the label "Awaiting Check-In".
3. WHILE an Appointment has status `cancelled`, THE Start_Consultation_Button SHALL be hidden from the Patient Chart.
4. WHILE an Appointment has status `completed`, THE Start_Consultation_Button SHALL be hidden from the Patient Chart.
5. WHILE an Appointment has an associated Visit with status `IN_PROGRESS`, THE Start_Consultation_Button SHALL be disabled, displaying the label "Consultation In Progress".
6. THE Doctor_Queue SHALL display only Appointments with status `checked_in` or `in_progress` under the active patient queue for today.

---

### Requirement 2: Atomic Start Consultation Transaction

**User Story:** As a Doctor, I want clicking "Start Consultation" to atomically create a Visit, a Medical Record, and an Audit Log entry in a single transaction, so that partial data never exists in the system.

#### Acceptance Criteria

1. WHEN a Doctor clicks the Start_Consultation_Button for a `checked_in` Appointment, THE System SHALL execute an Atomic_Transaction that: (a) creates a Visit with status `IN_PROGRESS`, (b) creates an empty Medical_Record linked to that Visit, and (c) creates an Audit_Log entry with action `VISIT_STARTED`.
2. WHEN the Atomic_Transaction succeeds, THE System SHALL update the Appointment status from `checked_in` to `in_progress`.
3. WHEN the Atomic_Transaction succeeds, THE System SHALL return the Visit ID to the client within the API response.
4. THE Audit_Log entry for `VISIT_STARTED` SHALL store: Doctor ID, Patient ID, Appointment ID, Tenant ID, UTC timestamp, and client IP address.
5. IF the Atomic_Transaction fails for any reason, THEN THE System SHALL roll back all changes and return an HTTP 500 response with a descriptive error message, leaving the Appointment status unchanged.
6. IF a Visit with status `IN_PROGRESS` already exists for the Appointment, THEN THE System SHALL reject the Start Consultation request with an HTTP 409 response and the message "A consultation is already active for this appointment."
7. THE System SHALL enforce that only the Doctor assigned to the Appointment may start the consultation, returning HTTP 403 for any other caller.

---

### Requirement 3: Visit Data Model and Relationships

**User Story:** As a system architect, I want the Visit to be the central anchor for all clinical data, so that every clinical sub-document is linked to a Visit rather than directly to a Patient.

#### Acceptance Criteria

1. THE System SHALL enforce that every Visit references exactly one Patient, one Appointment, one Doctor, and one Tenant.
2. THE System SHALL enforce that every Medical_Record references exactly one Visit, and a Visit may have at most one Medical_Record.
3. THE System SHALL enforce that a Visit cannot exist without an associated Patient (NOT NULL constraint on `patient_id`).
4. THE System SHALL enforce that a Medical_Record cannot exist without an associated Visit (NOT NULL constraint on `visit_id`).
5. THE System SHALL allow a Patient to have an unlimited number of Visits over their lifetime.
6. THE Visit SHALL support the following associated sub-documents: Vitals, Clinical_Notes, Diagnosis, Prescriptions, Lab_Orders, Radiology_Orders, Attachments, Billing_Items, and Audit_Logs — all linked via `visit_id`.

---

### Requirement 4: Clinical Documentation During Consultation

**User Story:** As a Doctor, I want to record vitals, clinical notes, diagnosis, prescriptions, lab orders, and radiology orders during an active consultation, so that a complete clinical picture is captured before I complete the visit.

#### Acceptance Criteria

1. WHILE a Visit has status `IN_PROGRESS`, THE System SHALL accept create and update operations for Vitals, Clinical_Notes, Diagnosis, Prescriptions, Lab_Orders, and Radiology_Orders linked to that Visit.
2. WHILE a Visit has status `IN_PROGRESS`, THE System SHALL accept file Attachments uploaded to that Visit, with each Attachment limited to 10 MB and allowed types: PDF, DOCX, DOC, JPG, JPEG, PNG, DICOM.
3. THE System SHALL allow a Doctor to view the Patient's complete Medical History (all prior completed Visits and their Medical Records) from within the Patient Chart.
4. WHEN a Lab_Order is created within an active Visit, THE System SHALL record: test name, ordering Doctor, ordered-at UTC timestamp, and status `PENDING`.
5. WHEN a Radiology_Order is created within an active Visit, THE System SHALL record: imaging type, body region, clinical indication, ordering Doctor, ordered-at UTC timestamp, and status `PENDING`.
6. WHEN a Prescription is created within an active Visit, THE System SHALL record: medication name, dosage, frequency, duration, route of administration, and prescribing Doctor.
7. WHEN Vitals are recorded for a Visit, THE System SHALL accept: blood pressure (systolic/diastolic in mmHg), heart rate (bpm), temperature (°C), oxygen saturation (%), respiratory rate (breaths/min), weight (kg), and height (cm) — all fields optional individually but at least one field SHALL be present per Vitals entry.

---

### Requirement 5: Sign Consultation

**User Story:** As a Doctor, I want to digitally sign the Medical Record before completing the consultation, so that the record is authenticated and non-repudiable.

#### Acceptance Criteria

1. WHEN a Doctor clicks "Sign Consultation", THE System SHALL generate a digital signature for the Medical_Record using the server-side RSA private key and store the signature hash on the Medical_Record.
2. WHEN the Medical_Record is signed, THE System SHALL record: signing Doctor ID, UTC timestamp of signing, and signature hash.
3. WHEN the Medical_Record is signed, THE System SHALL create an Audit_Log entry with action `RECORD_SIGNED`, storing Doctor ID, Visit ID, and UTC timestamp.
4. IF the Medical_Record is already signed, THEN THE System SHALL reject a second signing request with HTTP 409 and the message "Medical record is already signed."
5. THE "Complete Consultation" button SHALL remain disabled until the Medical_Record has been signed.
6. THE System SHALL enforce that only the Doctor assigned to the Visit may sign the Medical_Record, returning HTTP 403 for any other caller.

---

### Requirement 6: Complete Consultation — Atomic Completion Transaction

**User Story:** As a Doctor, I want clicking "Complete Consultation" to atomically finalise the visit and distribute data to all downstream departments, so that no partial completion state is possible.

#### Acceptance Criteria

1. WHEN a Doctor clicks "Complete Consultation" for a signed Medical_Record, THE System SHALL execute an Atomic_Transaction that: (a) sets Visit status to `COMPLETED`, (b) sets Medical_Record immutability flag to `true`, (c) sets Appointment status to `completed`, and (d) creates an Audit_Log entry with action `CONSULTATION_COMPLETED`.
2. WHEN the completion Atomic_Transaction succeeds, THE System SHALL mark all Prescriptions linked to the Visit as `AVAILABLE_TO_PHARMACY`.
3. WHEN the completion Atomic_Transaction succeeds, THE System SHALL mark all Lab_Orders linked to the Visit as `VISIBLE_TO_LAB`.
4. WHEN the completion Atomic_Transaction succeeds, THE System SHALL mark all Radiology_Orders linked to the Visit as `VISIBLE_TO_RADIOLOGY`.
5. WHEN the completion Atomic_Transaction succeeds, THE System SHALL create a Billing_Item for the consultation charge linked to the Visit and Tenant billing rules.
6. WHEN the completion Atomic_Transaction succeeds, THE System SHALL append a new entry to the Patient_Timeline for the completed Visit.
7. WHEN the completion Atomic_Transaction succeeds, THE System SHALL update the Patient's Medical History index to include the completed Visit.
8. IF the completion Atomic_Transaction fails, THEN THE System SHALL roll back all changes and return HTTP 500 with a descriptive error, leaving the Visit status as `IN_PROGRESS`.
9. THE System SHALL enforce that only the Doctor assigned to the Visit may complete the consultation, returning HTTP 403 for any other caller.
10. WHERE configured by a Hospital Admin, THE System SHALL generate a follow-up reminder for the Patient after consultation completion.

---

### Requirement 7: Medical Record Immutability and Version History

**User Story:** As a compliance officer, I want completed Medical Records to be immutable and all amendments to create a version history, so that the original clinical record is always preserved.

#### Acceptance Criteria

1. WHILE a Medical_Record has its immutability flag set to `true`, THE System SHALL reject any direct update to the Medical_Record fields with HTTP 403 and the message "Medical record is immutable."
2. WHEN a Doctor submits an amendment to a completed Medical_Record, THE System SHALL create a new Version_History entry that stores: the full prior state of the Medical_Record, the amending Doctor ID, the amendment reason, and the UTC timestamp.
3. WHEN a Version_History entry is created, THE System SHALL create an Audit_Log entry with action `RECORD_AMENDED`, storing: Doctor ID, Visit ID, amendment reason, and UTC timestamp.
4. THE System SHALL preserve every version of the Medical_Record indefinitely; no version SHALL ever be deleted or overwritten.
5. THE System SHALL return the complete ordered Version_History for a Medical_Record when requested, ordered from oldest to newest.

---

### Requirement 8: Audit Log Completeness

**User Story:** As a compliance officer, I want every significant action in the consultation lifecycle to be recorded in the Audit Log, so that a complete, tamper-evident trail exists for every Visit.

#### Acceptance Criteria

1. THE Audit_Log SHALL record an entry for each of the following actions: `VISIT_STARTED`, `VITALS_RECORDED`, `NOTES_UPDATED`, `DIAGNOSIS_SAVED`, `PRESCRIPTION_CREATED`, `LAB_ORDER_CREATED`, `RADIOLOGY_ORDER_CREATED`, `ATTACHMENT_UPLOADED`, `RECORD_SIGNED`, `CONSULTATION_COMPLETED`, `RECORD_AMENDED`.
2. THE System SHALL enforce that Audit_Log entries are append-only; no Audit_Log entry SHALL be updated or deleted after creation.
3. WHEN any audited action is performed, THE Audit_Log entry SHALL include: action type, actor User ID, Visit ID, Tenant ID, UTC timestamp, and client IP address.
4. THE System SHALL make the full Audit_Log for a Visit accessible to users with the `visit:audit_read` permission.

---

### Requirement 9: Role-Based Access Control for Visit Operations

**User Story:** As a Hospital Admin, I want each role to access only the visit data relevant to their function, so that clinical and operational data is protected from unauthorised access.

#### Acceptance Criteria

1. THE System SHALL restrict Visit creation (Start Consultation) to users with `role_id = 4` (Doctor) who are assigned to the Appointment.
2. THE System SHALL restrict Medical_Record read access to: the Doctor assigned to the Visit, users with `role_id = 2` (Hospital Admin), and users with `role_id = 1` (Super Admin).
3. WHEN a Visit is completed, THE System SHALL grant read access to Prescriptions for users with `role_id = 8` (Pharmacist) within the same Tenant.
4. WHEN a Visit is completed, THE System SHALL grant read access to Lab_Orders for users with `role_id = 6` (Lab_Technician) within the same Tenant.
5. WHEN a Visit is completed, THE System SHALL grant read access to Radiology_Orders for users with `role_id = 7` (Radiologist) within the same Tenant.
6. WHEN a Visit is completed, THE System SHALL grant read access to Billing_Items for users with `role_id = 9` (Billing_Clerk) within the same Tenant.
7. THE System SHALL enforce tenant isolation: no user SHALL access Visit or Medical_Record data belonging to a different Tenant.

---

### Requirement 10: Patient Timeline and Medical History

**User Story:** As a Doctor, I want to view a patient's complete visit history and medical timeline, so that I have full context when starting a new consultation.

#### Acceptance Criteria

1. THE System SHALL provide an endpoint that returns all completed Visits for a Patient, ordered by Visit start time descending, scoped to the caller's Tenant.
2. WHEN a Doctor opens the Patient Chart, THE System SHALL display: demographic info, all prior completed Visit summaries (date, doctor, primary diagnosis), active medications from prior Prescriptions, and known allergies from the Patient record.
3. THE Patient_Timeline SHALL display events in chronological order and include at minimum: Visit start, Visit completion, and any amendments.
4. THE System SHALL return the Patient_Timeline within 2 seconds for patients with up to 1,000 completed Visits.

---

### Requirement 11: Parser and Serializer Round-Trip Integrity

**User Story:** As a developer, I want all clinical data serialized to and from JSON/database formats to round-trip without data loss, so that no clinical information is corrupted in transit or storage.

#### Acceptance Criteria

1. THE System SHALL serialize and deserialize all Visit and Medical_Record domain objects to and from JSON without loss of field values.
2. THE System SHALL serialize and deserialize Vitals, Prescriptions, Lab_Orders, and Radiology_Orders sub-documents to and from their database representation without loss.
3. FOR ALL valid Medical_Record objects, serializing then deserializing SHALL produce an object equal to the original (round-trip property).
4. THE System SHALL validate all incoming clinical data payloads against defined Pydantic schemas, returning HTTP 422 with field-level error details for any validation failure.
