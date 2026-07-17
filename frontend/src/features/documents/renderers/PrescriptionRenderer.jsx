import React from 'react';
import PatientCard from '../components/PatientCard';
import ProviderCard from '../components/ProviderCard';
import MedicationTable from '../components/MedicationTable';
import MetadataPanel from '../components/MetadataPanel';

export default React.memo(function PrescriptionRenderer({ data, docMeta }) {
  const { patient, provider, encounter, medications = [], remarks, parser_metadata } = data;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div style={{
        padding: '16px 20px', borderRadius: '14px',
        background: 'linear-gradient(135deg,#14532d,#166534)', color: '#fff',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Prescription</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: '#bbf7d0' }}>
          {encounter?.date && <span>Date: {encounter.date}</span>}
          {encounter?.report_number && <span>Ref: {encounter.report_number}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <PatientCard patient={patient} />
        <ProviderCard provider={provider} />
      </div>

      <div>
        <p style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '12px' }}>
          Medications ({medications.length})
        </p>
        <MedicationTable medications={medications} />
      </div>

      {remarks && (
        <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#fefce8', border: '1px solid #fef08a' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', color: '#a16207', marginBottom: '6px' }}>Notes / Advice</p>
          <p style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.6 }}>{remarks}</p>
        </div>
      )}

      <MetadataPanel meta={parser_metadata} docMeta={docMeta} />
    </div>
  );
});
