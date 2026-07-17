import React from 'react';
import PatientCard from '../components/PatientCard';
import ProviderCard from '../components/ProviderCard';
import MetadataPanel from '../components/MetadataPanel';

function Section({ title, content, color = '#1e40af', bg = '#eff6ff', border = '#bfdbfe' }) {
  if (!content) return null;
  return (
    <div style={{ padding: '14px 16px', borderRadius: '12px', background: bg, border: `1px solid ${border}` }}>
      <p style={{ fontWeight: 700, fontSize: '13px', color, marginBottom: '8px' }}>{title}</p>
      <p style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{content}</p>
    </div>
  );
}

export default React.memo(function RadiologyRenderer({ data, docMeta }) {
  const { patient, provider, encounter, findings, impression, recommendations, remarks, additional_fields = {}, parser_metadata } = data;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div style={{
        padding: '16px 20px', borderRadius: '14px',
        background: 'linear-gradient(135deg,#1e1b4b,#312e81)', color: '#fff',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Radiology Report</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: '#c7d2fe' }}>
          {encounter?.report_date && <span>Date: {encounter.report_date}</span>}
          {encounter?.report_number && <span>Report No: {encounter.report_number}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <PatientCard patient={patient} />
        <ProviderCard provider={provider} />
      </div>

      {additional_fields?.technique && (
        <Section title="Technique / Method" content={additional_fields.technique} color="#6b21a8" bg="#faf5ff" border="#e9d5ff" />
      )}
      <Section title="Findings"        content={findings}        color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
      <Section title="Impression"      content={impression}      color="#065f46" bg="#f0fdf4" border="#bbf7d0" />
      <Section title="Recommendations" content={recommendations} color="#92400e" bg="#fffbeb" border="#fde68a" />
      {remarks && !findings && !impression && (
        <Section title="Remarks" content={remarks} color="#475569" bg="#f8fafc" border="#e2e8f0" />
      )}

      <MetadataPanel meta={parser_metadata} docMeta={docMeta} />
    </div>
  );
});
