/**
 * services/documentService.js
 * ----------------------------
 * Document management API calls.
 */

import { API_BASE_URL } from '../constants';
import { apiFetch } from './api';

async function apiFetchRaw(path, opts = {}, token = null) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Request failed: ${res.status}`);
  return data;
}

/**
 * Upload a document.
 * Returns { document_id, status, is_duplicate, message }
 */
export async function uploadDocument(token, { file, patientId, visitId, documentType = 'misc' }) {
  const form = new FormData();
  form.append('file', file);
  form.append('patient_id', patientId);
  form.append('document_type', documentType);
  if (visitId) form.append('visit_id', visitId);
  return apiFetchRaw('/documents/upload', { method: 'POST', body: form }, token);
}

/** Poll document processing status. */
export function getDocumentStatus(token, documentId) {
  return apiFetch(`/documents/${documentId}/status`, {}, token);
}

/** Get document metadata. */
export function getDocumentMeta(token, documentId) {
  return apiFetch(`/documents/${documentId}`, {}, token);
}

/** Get OCR text + structured JSON for a document. */
export function getDocumentContent(token, documentId) {
  return apiFetch(`/documents/${documentId}/content`, {}, token);
}

/** List all documents for a patient (metadata only). */
export function listPatientDocuments(token, patientId, visitId) {
  const qs = visitId ? `?visit_id=${visitId}` : '';
  return apiFetch(`/documents/patient/${patientId}${qs}`, {}, token);
}

/** Retry processing a FAILED document. */
export function retryProcessing(token, documentId) {
  return apiFetch(`/documents/${documentId}/retry-processing`, { method: 'POST' }, token);
}

/** Stream/download original file — returns a Blob URL. */
export async function downloadDocument(token, documentId, filename) {
  const res = await fetch(`${API_BASE_URL}/documents/${documentId}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  // Auto-trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'document';
  a.click();
  URL.revokeObjectURL(url);
}
