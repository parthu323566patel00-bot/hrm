/**
 * features/documents/DocumentUploader.jsx
 * -----------------------------------------
 * Document upload widget with async status polling.
 *
 * States visible to user:
 *   Idle → Uploading → Processing → Completed / Failed
 *
 * Props:
 *   token      - JWT bearer token
 *   patientId  - patient the document belongs to
 *   visitId    - (optional) link to a specific visit
 *   onUploaded - called with the document metadata when status = READY
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertCircle,
  Loader2, X, RefreshCw,
} from 'lucide-react';
import { uploadDocument, getDocumentStatus } from '../../services/documentService';

const POLL_INTERVAL_MS  = 2000;
const POLL_MAX_ATTEMPTS = 30;   // 30 × 2s = 60 s max
const TERMINAL = new Set(['READY', 'FAILED', 'MANUAL_REVIEW_REQUIRED']);

const DOC_TYPES = [
  { value: 'misc',              label: 'General / Misc' },
  { value: 'lab_report',       label: 'Lab Report' },
  { value: 'radiology',        label: 'Radiology Report' },
  { value: 'prescription',     label: 'Prescription' },
  { value: 'discharge_summary',label: 'Discharge Summary' },
  { value: 'insurance',        label: 'Insurance' },
  { value: 'referral',         label: 'Referral Letter' },
  { value: 'consent',          label: 'Consent Form' },
  { value: 'id_proof',         label: 'ID Proof' },
  { value: 'billing',          label: 'Billing Document' },
];

const STATUS_INFO = {
  UPLOADING:              { label: 'Uploading…',      color: '#1d4ed8', icon: Loader2 },
  UPLOADED:               { label: 'Uploaded',        color: '#1d4ed8', icon: Loader2 },
  QUEUED:                 { label: 'Processing…',     color: '#92400e', icon: Loader2 },
  PROCESSING:             { label: 'Processing…',     color: '#92400e', icon: Loader2 },
  OCR_COMPLETED:          { label: 'Analysing…',      color: '#92400e', icon: Loader2 },
  PARSING:                { label: 'Extracting data…',color: '#92400e', icon: Loader2 },
  READY:                  { label: 'Completed',       color: '#065f46', icon: CheckCircle2 },
  MANUAL_REVIEW_REQUIRED: { label: 'Manual review needed', color: '#b45309', icon: AlertCircle },
  FAILED:                 { label: 'Processing failed', color: '#991b1b', icon: AlertCircle },
};

export default function DocumentUploader({ token, patientId, visitId, onUploaded }) {
  const [file, setFile]           = useState(null);
  const [docType, setDocType]     = useState('misc');
  const [uiStatus, setUiStatus]   = useState('idle'); // idle|uploading|processing|done|failed
  const [docStatus, setDocStatus] = useState('');
  const [docId, setDocId]         = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = useCallback((id) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const s = await getDocumentStatus(token, id);
        setDocStatus(s.status);
        if (TERMINAL.has(s.status)) {
          stopPolling();
          setUiStatus(s.status === 'READY' ? 'done' : 'failed');
          if (s.status === 'READY' && onUploaded) onUploaded(s);
        }
      } catch (_) {}
      if (attempts >= POLL_MAX_ATTEMPTS) {
        stopPolling();
        setUiStatus('failed');
        setErrorMsg('Processing timed out. You can retry from the document list.');
      }
    }, POLL_INTERVAL_MS);
  }, [token, onUploaded]);

  const handleUpload = async () => {
    if (!file) return;
    setErrorMsg('');
    setUiStatus('uploading');
    setDocStatus('UPLOADING');

    try {
      const res = await uploadDocument(token, { file, patientId, visitId, documentType: docType });
      setDocId(res.document_id);
      setIsDuplicate(res.is_duplicate);
      setDocStatus(res.status);
      setUiStatus('processing');

      if (res.is_duplicate) {
        // Duplicate — already READY, no need to poll
        setUiStatus('done');
        setDocStatus('READY');
        if (onUploaded) onUploaded(res);
      } else {
        startPolling(res.document_id);
      }
    } catch (err) {
      setUiStatus('failed');
      setErrorMsg(err.message || 'Upload failed.');
    }
  };

  const reset = () => {
    stopPolling();
    setFile(null);
    setDocType('misc');
    setUiStatus('idle');
    setDocStatus('');
    setDocId(null);
    setErrorMsg('');
    setIsDuplicate(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const si = STATUS_INFO[docStatus] || null;
  const isSpinning = ['UPLOADING', 'UPLOADED', 'QUEUED', 'PROCESSING', 'OCR_COMPLETED', 'PARSING'].includes(docStatus);

  return (
    <div style={{
      border: '1px solid var(--color-border)', borderRadius: '14px',
      padding: '20px', background: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <FileText size={16} color="var(--color-primary)" />
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
          Upload Document
        </span>
      </div>

      {uiStatus === 'idle' && (
        <>
          {/* File drop zone */}
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '20px', border: '2px dashed #cbd5e1', borderRadius: '12px',
            cursor: 'pointer', background: '#f8fafc', marginBottom: '12px',
            transition: 'all .2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
          >
            <Upload size={22} color="#94a3b8" />
            <span style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', fontWeight: 600 }}>
              {file ? file.name : 'Click to select a file'}
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              PDF, JPG, PNG, TIFF — max 50 MB
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0] || null)}
            />
          </label>

          {/* Document type */}
          <div style={{ marginBottom: '12px' }}>
            <label className="form-label">Document Type</label>
            <select className="form-input" style={{ padding: '9px 12px', background: '#f8fafc' }}
              value={docType} onChange={e => setDocType(e.target.value)}>
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {errorMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#991b1b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file}
            className="submit-btn"
            style={{ padding: '10px', opacity: !file ? 0.5 : 1 }}
          >
            <Upload size={14} /> Upload
          </button>
        </>
      )}

      {/* Processing / done / failed states */}
      {uiStatus !== 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Status indicator */}
          {si && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 16px', borderRadius: '10px',
              background: `${si.color}15`,
              border: `1px solid ${si.color}40`,
            }}>
              {isSpinning
                ? <Loader2 size={18} style={{ color: si.color, animation: 'spin 1s linear infinite' }} />
                : <si.icon size={18} style={{ color: si.color }} />
              }
              <div>
                <p style={{ fontWeight: 700, fontSize: '13px', color: si.color }}>{si.label}</p>
                {isDuplicate && (
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Duplicate detected — linked to existing record.
                  </p>
                )}
                {docId && (
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    Document #{docId}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Reset / retry buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={reset}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 14px', borderRadius: '8px',
                background: '#f1f5f9', border: '1px solid #e2e8f0',
                color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}>
              <X size={13} /> {uiStatus === 'done' ? 'Upload Another' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
