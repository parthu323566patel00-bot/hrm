import React from 'react';
import { Clock, Cpu, FileText } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0',
      borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#334155' }}>{value}</span>
    </div>
  );
}

export default React.memo(function MetadataPanel({ meta, docMeta }) {
  if (!meta && !docMeta) return null;
  return (
    <div style={{
      padding: '14px 16px', borderRadius: '12px',
      background: '#f8fafc', border: '1px solid #e2e8f0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Cpu size={14} color="#64748b" />
        <span style={{ fontWeight: 700, fontSize: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Processing Metadata
        </span>
      </div>
      <Row label="Parser Version" value={meta?.version} />
      <Row label="OCR Engine"     value={meta?.engine || docMeta?.ocr_engine} />
      <Row label="Parsed At"      value={meta?.parsed_at ? new Date(meta.parsed_at).toLocaleString() : null} />
      {meta?.confidence != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12px' }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>Confidence</span>
          <ConfidenceBadge confidence={meta.confidence} />
        </div>
      )}
      <Row label="File Size"      value={docMeta?.file_size ? `${(docMeta.file_size / 1024).toFixed(0)} KB` : null} />
      <Row label="Document Type"  value={docMeta?.document_type} />
      <Row label="Upload Status"  value={docMeta?.status} />
    </div>
  );
});
