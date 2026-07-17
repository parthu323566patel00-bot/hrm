/**
 * features/documents/DocumentViewerModal.jsx
 * ---------------------------------------------
 * Full-screen document viewer modal.
 *
 * Left panel  — ClinicalRenderer (structured report)
 * Right panel — Original PDF / image viewer + download
 *
 * Data is loaded once on open. Re-opening the same document
 * is nearly instant because the component caches the fetch result.
 *
 * Props:
 *   documentId  - document id to load
 *   token       - JWT bearer token
 *   onClose     - dismiss handler
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, FileText, Download, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../constants';
import { getDocumentMeta, getDocumentContent, downloadDocument } from '../../services/documentService';
import ClinicalRenderer from './ClinicalRenderer';
import StatusBadge from './components/StatusBadge';

const DOC_TYPE_LABELS = {
  lab_report:        'Laboratory Report',
  prescription:      'Prescription',
  radiology:         'Radiology Report',
  discharge_summary: 'Discharge Summary',
  insurance:         'Insurance',
  referral:          'Referral Letter',
  consent:           'Consent Form',
  id_proof:          'Identity Proof',
  billing:           'Billing Document',
  misc:              'Document',
  unknown:           'Unknown Document',
};

export default function DocumentViewerModal({ documentId, token, onClose }) {
  const [meta, setMeta]         = useState(null);
  const [content, setContent]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [pdfUrl, setPdfUrl]     = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('structured'); // 'structured' | 'original'

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Load metadata + content in parallel — one render cycle
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [metaData, contentData] = await Promise.all([
        getDocumentMeta(token, documentId),
        getDocumentContent(token, documentId).catch(() => null), // content may not exist yet
      ]);
      setMeta(metaData);
      setContent(contentData);
    } catch (err) {
      setError(err.message || 'Failed to load document.');
    } finally {
      setLoading(false);
    }
  }, [token, documentId]);

  useEffect(() => { load(); }, [load]);

  // Lazy-load PDF only when user switches to original tab
  useEffect(() => {
    if (activeTab !== 'original' || pdfUrl || !meta) return;
    // Fetch as blob for inline viewing
    fetch(`${API_BASE_URL}/documents/${documentId}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.blob())
      .then(blob => setPdfUrl(URL.createObjectURL(blob)))
      .catch(() => {});
  }, [activeTab, pdfUrl, meta, token, documentId]);

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const handleDownload = async () => {
    if (!meta || downloading) return;
    setDownloading(true);
    try { await downloadDocument(token, documentId, meta.original_filename); }
    catch (_) {}
    finally { setDownloading(false); }
  };

  const docTypeLabel = DOC_TYPE_LABELS[meta?.document_type || 'misc'] || 'Document';
  const isReady = meta?.status === 'READY';
  const isProcessing = ['QUEUED', 'PROCESSING', 'OCR_COMPLETED', 'PARSING'].includes(meta?.status);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1500,
        background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '20px', width: '100%',
          maxWidth: '1200px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 64px rgba(15,23,42,0.3)', overflow: 'hidden',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 22px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '9px',
              background: 'var(--color-primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={17} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                  {meta ? docTypeLabel : 'Loading…'}
                </p>
                {meta && <StatusBadge status={meta.status} />}
              </div>
              {meta && (
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                  {meta.original_filename} · {meta.file_size ? `${(meta.file_size/1024).toFixed(0)} KB` : ''}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={load} title="Refresh"
              style={{ width:32, height:32, borderRadius:'8px', background:'#f8fafc',
                border:'1px solid #e2e8f0', display:'flex', alignItems:'center',
                justifyContent:'center', cursor:'pointer', color:'#64748b' }}>
              <RefreshCw size={13} />
            </button>
            <button onClick={handleDownload} disabled={downloading || !meta}
              title="Download original"
              style={{ display:'flex', alignItems:'center', gap:'5px',
                padding:'6px 12px', borderRadius:'8px', border:'none',
                background:'var(--color-primary)', color:'#fff',
                fontSize:'12px', fontWeight:700,
                cursor: (!meta || downloading) ? 'not-allowed' : 'pointer',
                opacity: !meta ? 0.5 : 1 }}>
              <Download size={13} /> {downloading ? '…' : 'Download'}
            </button>
            <button onClick={onClose}
              style={{ width:32, height:32, borderRadius:'8px', background:'#f8fafc',
                border:'1px solid #e2e8f0', display:'flex', alignItems:'center',
                justifyContent:'center', cursor:'pointer', color:'#64748b' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #f1f5f9',
          padding: '0 16px', flexShrink: 0, background: '#fff',
        }}>
          {[
            { key: 'structured', label: 'Clinical Report' },
            { key: 'original',   label: 'Original Document' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{
                padding: '10px 16px', borderBottom: `2px solid ${activeTab === key ? 'var(--color-primary)' : 'transparent'}`,
                background: 'none', border: 'none',
                color: activeTab === key ? 'var(--color-primary)' : '#64748b',
                fontSize: '12px', fontWeight: activeTab === key ? 700 : 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: '13px' }}>Loading document…</div>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: '20px', borderRadius: '12px', background: '#fef2f2',
              border: '1px solid #fecaca', color: '#991b1b', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {/* Structured clinical report tab */}
          {!loading && !error && activeTab === 'structured' && (
            <>
              {isProcessing && (
                <div style={{ padding: '14px 16px', borderRadius: '12px', marginBottom: '20px',
                  background: '#eff6ff', border: '1px solid #bfdbfe',
                  fontSize: '13px', color: '#1e40af', fontWeight: 600 }}>
                  ⏳ Document is still being processed. Structured report will appear once ready.
                </div>
              )}
              {isReady && content ? (
                <ClinicalRenderer
                  structuredJson={content.structured_json}
                  rawText={content.raw_text}
                  docMeta={meta}
                  onDownload={handleDownload}
                />
              ) : !isProcessing && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <FileText size={36} style={{ marginBottom: '12px', opacity: 0.3 }} />
                  <p style={{ fontSize: '13px' }}>No structured content available for this document.</p>
                </div>
              )}
            </>
          )}

          {/* Original document tab */}
          {!loading && !error && activeTab === 'original' && (
            <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {meta?.mime_type === 'application/pdf' ? (
                pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    style={{ flex: 1, border: 'none', borderRadius: '10px', background: '#f8fafc' }}
                    title="Original PDF"
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                    <p style={{ fontSize: '13px' }}>Loading PDF viewer…</p>
                  </div>
                )
              ) : pdfUrl ? (
                <img src={pdfUrl} alt="Document" style={{
                  maxWidth: '100%', borderRadius: '10px',
                  border: '1px solid #e2e8f0', maxHeight: '70vh', objectFit: 'contain',
                }} />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '14px' }}>
                    Click download to view this file type.
                  </p>
                  <button onClick={handleDownload}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '9px 18px', borderRadius: '10px',
                      background: 'var(--color-primary)', border: 'none',
                      color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    }}>
                    <Download size={14} /> Download File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
