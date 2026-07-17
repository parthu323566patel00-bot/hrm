/**
 * features/documents/PatientDocumentsPanel.jsx
 * -----------------------------------------------
 * Lists all documents for a patient (metadata only — lazy load).
 * Clicking "View" opens DocumentViewerModal which renders the
 * structured clinical report.
 *
 * Props:
 *   token     - JWT bearer token
 *   patientId - patient to list documents for
 *   visitId   - (optional) filter to a specific visit
 *   onUpload  - (optional) called when a new upload completes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Paperclip, FileText, Eye, Download,
  RefreshCw, Upload, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { listPatientDocuments, downloadDocument } from '../../services/documentService';
import DocumentViewerModal from './DocumentViewerModal';
import StatusBadge from './components/StatusBadge';
import DocumentUploader from './DocumentUploader';

const DOC_TYPE_LABELS = {
  lab_report:        'Lab Report',
  prescription:      'Prescription',
  radiology:         'Radiology',
  discharge_summary: 'Discharge Summary',
  insurance:         'Insurance',
  referral:          'Referral',
  consent:           'Consent',
  id_proof:          'ID Proof',
  billing:           'Billing',
  misc:              'Document',
  unknown:           'Unknown',
};

const DOC_TYPE_COLORS = {
  lab_report:        { bg: '#dbeafe', color: '#1d4ed8' },
  prescription:      { bg: '#dcfce7', color: '#166534' },
  radiology:         { bg: '#ede9fe', color: '#6d28d9' },
  discharge_summary: { bg: '#fee2e2', color: '#991b1b' },
  billing:           { bg: '#fefce8', color: '#a16207' },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function PatientDocumentsPanel({ token, patientId, visitId, onUpload }) {
  const [docs, setDocs]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [viewingId, setViewingId]   = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true); setErrorMsg('');
    try {
      const data = await listPatientDocuments(token, patientId, visitId);
      setDocs(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [token, patientId, visitId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleUploaded = () => {
    setShowUpload(false);
    setRefreshKey(k => k + 1);
    onUpload?.();
  };

  const handleDownload = async (doc) => {
    try { await downloadDocument(token, doc.id, doc.original_filename); }
    catch (_) {}
  };

  return (
    <>
      <div>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paperclip size={15} color="var(--color-primary)" />
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
              Documents
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: '#64748b',
              background: '#f1f5f9', padding: '1px 7px', borderRadius: '20px',
            }}>
              {docs.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={load} title="Refresh"
              style={{ width:28, height:28, borderRadius:'7px', background:'#f8fafc',
                border:'1px solid #e2e8f0', display:'flex', alignItems:'center',
                justifyContent:'center', cursor:'pointer', color:'#64748b' }}>
              <RefreshCw size={12} />
            </button>
            <button onClick={() => setShowUpload(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '8px',
                background: showUpload ? 'var(--color-primary-light)' : 'var(--color-primary)',
                border: showUpload ? '1px solid rgba(0,172,193,0.3)' : 'none',
                color: showUpload ? 'var(--color-primary)' : '#fff',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}>
              <Upload size={12} /> {showUpload ? 'Cancel' : 'Upload'}
            </button>
          </div>
        </div>

        {/* Upload area */}
        {showUpload && (
          <div style={{ marginBottom: '14px' }}>
            <DocumentUploader
              token={token}
              patientId={patientId}
              visitId={visitId}
              onUploaded={handleUploaded}
            />
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
            background: '#fef2f2', border: '1px solid #fecaca',
            color: '#991b1b', fontSize: '12px' }}>
            {errorMsg}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
            Loading…
          </p>
        )}

        {/* Empty */}
        {!loading && docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
            <Paperclip size={28} style={{ marginBottom: '8px', opacity: 0.3 }} />
            <p style={{ fontSize: '13px' }}>No documents uploaded yet.</p>
          </div>
        )}

        {/* Document list */}
        {!loading && docs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {docs.map(doc => {
              const tc = DOC_TYPE_COLORS[doc.document_type] || { bg: '#f1f5f9', color: '#475569' };
              const isReady = doc.status === 'READY';
              return (
                <div key={doc.id} style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center', gap: '12px',
                  padding: '11px 14px', borderRadius: '10px',
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='rgba(0,172,193,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='#f8fafc'; e.currentTarget.style.borderColor='#e2e8f0'; }}
                >
                  {/* Type badge */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '8px',
                    background: tc.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <FileText size={16} style={{ color: tc.color }} />
                  </div>

                  {/* Info */}
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '200px' }} title={doc.original_filename}>
                        {doc.original_filename}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '1px 7px',
                        borderRadius: '20px', background: tc.bg, color: tc.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                      </span>
                      <StatusBadge status={doc.status} />
                    </div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {formatDate(doc.uploaded_at)} · {formatSize(doc.file_size)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {isReady && (
                      <button onClick={() => setViewingId(doc.id)}
                        title="View structured report"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '5px 10px', borderRadius: '7px',
                          background: 'var(--color-primary)', border: 'none',
                          color: '#fff', fontSize: '11px', fontWeight: 700,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>
                        <Eye size={12} /> View
                      </button>
                    )}
                    <button onClick={() => handleDownload(doc)}
                      title="Download original"
                      style={{
                        width: 28, height: 28, borderRadius: '7px',
                        background: '#f1f5f9', border: '1px solid #e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#475569',
                      }}>
                      <Download size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {viewingId && (
        <DocumentViewerModal
          documentId={viewingId}
          token={token}
          onClose={() => setViewingId(null)}
        />
      )}
    </>
  );
}
