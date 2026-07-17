/**
 * services/patientService.js
 * ---------------------------
 * Patient-related API calls.
 *
 * GET /patients/ now returns { data, meta } — no separate /count call needed.
 */

import { apiFetch } from './api';

/** Register a new patient. */
export async function createPatient(token, patientData) {
  return apiFetch('/patients/', { method: 'POST', body: JSON.stringify(patientData) }, token);
}

/**
 * List / search patients — returns paginated envelope { data, meta }.
 * @param {string} q         - Optional search query (name, phone, email)
 * @param {number} page      - 1-based page number
 * @param {number} page_size - Records per page
 */
export async function listPatients(token, q = '', page = 1, page_size = 7) {
  const params = new URLSearchParams({ page, page_size });
  if (q) params.set('q', q);
  return apiFetch(`/patients/?${params.toString()}`, {}, token);
}

/** Get a single patient by ID. */
export async function getPatient(token, patientId) {
  return apiFetch(`/patients/${patientId}`, {}, token);
}

/** Update a patient. */
export async function updatePatient(token, patientId, data) {
  return apiFetch(`/patients/${patientId}`, { method: 'PUT', body: JSON.stringify(data) }, token);
}
