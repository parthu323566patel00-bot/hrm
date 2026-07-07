/**
 * services/visitService.js
 * -------------------------
 * Patient Visit & Medical Record Lifecycle API calls.
 */

import { apiFetch } from './api';
import { API_BASE_URL } from '../constants';

async function apiFetchRaw(path, opts = {}, token = null) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Request failed: ${res.status}`);
  return data;
}

/** Check if Start Consultation button should be enabled for an appointment */
export function canStartConsultation(token, appointmentId) {
  return apiFetch(`/visits/${appointmentId}/can-start`, {}, token);
}

/** Atomically start a consultation — creates Visit + MedicalRecord + AuditLog */
export function startConsultation(token, appointmentId) {
  return apiFetch('/visits/start',
    { method: 'POST', body: JSON.stringify({ appointment_id: appointmentId }) },
    token);
}

/** Get full patient chart for a visit */
export function getVisitChart(token, visitId) {
  return apiFetch(`/visits/${visitId}`, {}, token);
}

/** Get all completed visits for a patient (history) */
export function getPatientHistory(token, patientId) {
  return apiFetch(`/visits/patient/${patientId}`, {}, token);
}

/** Record vitals for an active visit */
export function saveVitals(token, visitId, data) {
  return apiFetch(`/visits/${visitId}/vitals`,
    { method: 'POST', body: JSON.stringify(data) }, token);
}

/** Add a clinical note */
export function addNote(token, visitId, content) {
  return apiFetch(`/visits/${visitId}/notes`,
    { method: 'POST', body: JSON.stringify({ content }) }, token);
}

/** Update an existing clinical note */
export function updateNote(token, visitId, noteId, content) {
  return apiFetch(`/visits/${visitId}/notes/${noteId}`,
    { method: 'PUT', body: JSON.stringify({ content }) }, token);
}

/** Add a diagnosis */
export function addDiagnosis(token, visitId, data) {
  return apiFetch(`/visits/${visitId}/diagnoses`,
    { method: 'POST', body: JSON.stringify(data) }, token);
}

/** Add a prescription */
export function addPrescription(token, visitId, data) {
  return apiFetch(`/visits/${visitId}/prescriptions`,
    { method: 'POST', body: JSON.stringify(data) }, token);
}

/** Add a lab order */
export function addLabOrder(token, visitId, data) {
  return apiFetch(`/visits/${visitId}/lab-orders`,
    { method: 'POST', body: JSON.stringify(data) }, token);
}

/** Add a radiology order */
export function addRadiologyOrder(token, visitId, data) {
  return apiFetch(`/visits/${visitId}/radiology-orders`,
    { method: 'POST', body: JSON.stringify(data) }, token);
}

/** Upload attachments to a visit */
export function uploadAttachments(token, visitId, files) {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  return apiFetchRaw(`/visits/${visitId}/attachments`,
    { method: 'POST', body: form }, token);
}

/** Digitally sign the medical record */
export function signConsultation(token, visitId) {
  return apiFetch(`/visits/${visitId}/sign`, { method: 'POST' }, token);
}

/** Complete the consultation (atomic) */
export function completeConsultation(token, visitId) {
  return apiFetch(`/visits/${visitId}/complete`, { method: 'POST' }, token);
}

/** Get audit log for a visit */
export function getAuditLog(token, visitId) {
  return apiFetch(`/visits/${visitId}/audit-log`, {}, token);
}
