/**
 * UnknownRenderer — graceful fallback for unclassified documents.
 * Always shows OCR text + download button. Never crashes.
 */
import React from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import MetadataPanel from '../components/MetadataPanel';

export default React.memo(function UnknownRenderer({ data, docMeta, rawText, onDownload }) {
  const { remarks, additional_fields = {}, parser_metadata } = data || {};
  const displayText = rawText || remarks || additional_fields?.raw_text_preview || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Warning banner */}
      <div style={{
        padding: '14px 16px', borderRadius: '12px',
        background: '#fffbeb', border: '1px solid #fcd34d',
        display: 'flex', alignItems: 'flex-start', gap: '10px',
      }}>
        <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontWeight: 700, fontSize: '13px', color: '#92400e', marginBottom: '4px' }}>
            Document Could Not Be Fully Structured
          </p>
          <p style={{ fontSize: '12px', color: '#a16207', lineHeight: 1.5 }}>
            This document type was not recognized or parsed. The original file and extracted
            text are preserved below. You can download the original document.
          </p>
        </div>
      </div>

      {/* Download button */}
      {onDownload && (
        <button onClick={onDownload}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start',
            padding: '9px 18px', borderRadius: '10px',
            background: 'var(--color-primary)', border: 'none', color: '#fff',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          }}>
          <FileText size={14} /> Download Original Document
        </button>
      )}

      {/* OCR extracted text */}
      {displayText && (
        <div>
          <p style={{ fontWeight: 700, fontSize: '13px', color: '#475569', marginBottom: '8px',
            textTransform: 'uppercase', letterSpacing: '0.4px', fontSize: '11px' }}>
            Extracted Text (OCR Output)
          </p>
          <div style={{
            padding: '14px 16px', borderRadius: '10px', background: '#f8fafc',
            border: '1px solid #e2e8f0', maxHeight: '400px', overflowY: 'auto',
            fontFamily: 'monospace', fontSize: '12px', color: '#334155',
            lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {displayText}
          </div>
        </div>
      )}

      {!displayText && (
        <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
          No text was extracted from this document.
        </p>
      )}

      <MetadataPanel meta={parser_metadata} docMeta={docMeta} />
    </div>
  );
});
