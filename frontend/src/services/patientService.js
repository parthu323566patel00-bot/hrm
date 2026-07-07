/**
 * services/patientService.js
 * ---------------------------
 * Patient-related API calls.
 */

import { apiFetch } from './api';

/**
 * Register a new patient.
 */
export async function createPatient(token, patientData) {
  return apiFetch('/patients/', { method: 'POST', body: JSON.stringify(patientData) }, token);
}

/**
 * Get total patient count (for pagination).
 */
export async function countPatients(token, q = '') {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const qs = params.toString();
  return apiFetch(`/patients/count${qs ? '?' + qs : ''}`, {}, token);
}

/**
 * List / search patients with pagination.
 * @param {string} q     - Optional search query (name, phone, email)
 * @param {number} skip  - Records to skip (offset)
 * @param {number} limit - Max records to return
 */
export async function listPatients(token, q = '', skip = 0, limit = 7) {
  const params = new URLSearchParams({ skip, limit });
  if (q) params.set('q', q);
  return apiFetch(`/patients/?${params.toString()}`, {}, token);
}

/**
 * Get a single patient by ID.
 */
export async function getPatient(token, patientId) {
  return apiFetch(`/patients/${patientId}`, {}, token);
}

/**
 * Update a patient.
 */
export async function updatePatient(token, patientId, data) {
  return apiFetch(`/patients/${patientId}`, { method: 'PUT', body: JSON.stringify(data) }, token);
}
