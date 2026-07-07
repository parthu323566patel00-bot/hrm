/**
 * services/appointmentService.js
 * --------------------------------
 * Appointment-related API calls.
 */

import { API_BASE_URL } from '../constants';

// Raw fetch needed for multipart/form-data (file upload)
async function apiFetchRaw(path, opts = {}, token = null) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Request failed: ${res.status}`);
  return data;
}

import { apiFetch } from './api';

/** Doctors in a specific department */
export function fetchDoctorsByDept(token, deptId) {
  return apiFetch(`/appointments/doctors?department_id=${deptId}`, {}, token);
}

/** All doctors regardless of department */
export function fetchAllDoctors(token) {
  return apiFetch('/appointments/doctors/all', {}, token);
}

/** Available time slots for a doctor on a given date (YYYY-MM-DD) */
export function fetchSlots(token, doctorId, date) {
  return apiFetch(`/appointments/slots?doctor_id=${doctorId}&date=${date}`, {}, token);
}

/**
 * Book an appointment with optional report file attachments.
 * Uses multipart/form-data so files can be included.
 */
export async function bookAppointment(token, data, files = []) {
  const form = new FormData();
  form.append('patient_id', data.patient_id);
  form.append('doctor_id', data.doctor_id);
  if (data.department_id) form.append('department_id', data.department_id);
  form.append('appointment_date', data.appointment_date);
  form.append('time_slot', data.time_slot);
  if (data.notes) form.append('notes', data.notes);
  files.forEach(f => form.append('reports', f));

  return apiFetchRaw('/appointments/', { method: 'POST', body: form }, token);
}

/** Doctor's own appointments with optional filter: today | upcoming | past | all */
export function listMyAppointments(token, filter = 'upcoming') {
  return apiFetch(`/appointments/my?filter=${filter}`, {}, token);
}

/** Today's appointments enriched with patient + doctor names */
export function listTodayAppointments(token) {
  return apiFetch('/appointments/today', {}, token);
}

/** List appointments (optionally filter by patient_id / doctor_id / date) */
export function listAppointments(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/appointments/${qs ? '?' + qs : ''}`, {}, token);
}

/**
 * Check in a patient — sets appointment status to 'checked_in'.
 */
export function checkInAppointment(token, appointmentId) {
  return apiFetch(
    `/appointments/${appointmentId}`,
    { method: 'PATCH', body: JSON.stringify({ status: 'checked_in' }) },
    token,
  );
}

/**
 * Cancel an appointment.
 */
export function cancelAppointment(token, appointmentId) {
  return apiFetch(
    `/appointments/${appointmentId}`,
    { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) },
    token,
  );
}
