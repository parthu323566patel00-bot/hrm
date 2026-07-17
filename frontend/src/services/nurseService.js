/**
 * services/nurseService.js
 * -------------------------
 * Nurse workflow API calls.
 */

import { apiFetch } from './api';

/** Today's checked-in / in-progress patients for the nurse's ward. */
export function fetchNurseQueue(token) {
  return apiFetch('/nurse/queue', {}, token);
}

/** Full care plan for a visit (notes, orders, vitals history). */
export function fetchCarePlan(token, visitId) {
  return apiFetch(`/nurse/visits/${visitId}`, {}, token);
}

/**
 * Record PRE-CONSULTATION vitals for a checked-in appointment
 * (before the doctor starts — no visit exists yet).
 * @param {number} appointmentId
 * @param {object} data - VitalsCreate fields (at least one required)
 */
export function recordPreVitals(token, appointmentId, data) {
  return apiFetch(
    `/nurse/appointments/${appointmentId}/pre-vitals`,
    { method: 'POST', body: JSON.stringify(data) },
    token,
  );
}

/**
 * Get pre-vitals recorded for a checked-in appointment.
 * @param {number} appointmentId
 */
export function getPreVitals(token, appointmentId) {
  return apiFetch(`/nurse/appointments/${appointmentId}/pre-vitals`, {}, token);
}

/**
 * Record vitals during an active consultation (visit must be IN_PROGRESS).
 * @param {number} visitId
 * @param {object} data - VitalsCreate fields (at least one required)
 */
export function recordVitals(token, visitId, data) {
  return apiFetch(
    `/nurse/visits/${visitId}/vitals`,
    { method: 'POST', body: JSON.stringify(data) },
    token,
  );
}

/**
 * Log a nursing procedure (IV, blood draw, medication round…).
 * @param {number} visitId
 * @param {{ description: string, observation?: string }} data
 */
export function logProcedure(token, visitId, data) {
  return apiFetch(
    `/nurse/visits/${visitId}/procedure`,
    { method: 'POST', body: JSON.stringify(data) },
    token,
  );
}

/**
 * Submit discharge checklist.
 * @param {number} visitId
 * @param {{ checklist_notes?: string, bed_number?: string }} data
 */
export function submitDischargeChecklist(token, visitId, data) {
  return apiFetch(
    `/nurse/visits/${visitId}/discharge-checklist`,
    { method: 'POST', body: JSON.stringify(data) },
    token,
  );
}
