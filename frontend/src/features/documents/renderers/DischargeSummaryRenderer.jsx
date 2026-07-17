import React from 'react';
import PatientCard from '../components/PatientCard';
import ProviderCard from '../components/ProviderCard';
import MedicationTable from '../components/MedicationTable';
import MetadataPanel from '../components/MetadataPanel';

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
      <span style={{ color: '#64748b', fontWeight: 600, minWidth: '140px' }}>{label}</span>
      <span style={{ color: '#0f172a' }}>{value}</span>
    </div>
  );
}

export default React.memo(function DischargeSummaryRenderer({ data, docMeta }) {
  const { patient, provider, encounter = {}, diagnosis = [], procedures = [], medications = [], recommendations, remarks, additional_fields = {}, parser_metadata } = data;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div style={{
        padding: '16px 20px', borderRadius: '14px',
        background: 'linear-gradient(135deg,#7c2d12,#9a3412)', color: '#fff',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Discharge Summary</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: '#fecdd3' }}>
          {encounter.admission_date && <span>Admitted: {encounter.admission_date}</span>}
          {encounter.discharge_date && <span>Discharged: {encounter.discharge_date}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <PatientCard patient={patient} />
        <ProviderCard provider={provider} />
      </div>

      {/* Diagnosis */}
      {diagnosis.length > 0 && (
        <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', color: '#991b1b', marginBottom: '8px' }}>Diagnosis</p>
          {diagnosis.map((d, i) => (
            <div key={i} style={{ fontSize: '13px', color: '#0f172a', padding: '4px 0' }}>
              {d.code && <span style={{ color: '#64748b', marginRight: '8px' }}>[{d.code}]</span>}
              {d.description}
            </div>
          ))}
        </div>
      )}

      {/* Procedures */}
      {procedures.filter(p => p.description).length > 0 && (
        <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f0f9ff', border: '1px solid #bae6fd' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', color: '#0369a1', marginBottom: '8px' }}>Procedures</p>
          {procedures.filter(p => p.description).map((p, i) => (
            <p key={i} style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.6 }}>{p.description}</p>
          ))}
        </div>
      )}

      {/* Medications on discharge */}
      {medications.length > 0 && (
        <div>
          <p style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '12px' }}>
            Medications on Discharge
          </p>
          <MedicationTable medications={medications} />
        </div>
      )}

      {/* Follow-up */}
      {(recommendations || remarks) && (
        <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#fefce8', border: '1px solid #fef08a' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', color: '#a16207', marginBottom: '8px' }}>
            Follow-up / Advice
          </p>
          <p style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.6 }}>
            {recommendations || remarks}
          </p>
        </div>
      )}

      {/* Condition on discharge */}
      {additional_fields?.condition_on_discharge && (
        <InfoRow label="Condition on Discharge" value={additional_fields.condition_on_discharge} />
      )}

      <MetadataPanel meta={parser_metadata} docMeta={docMeta} />
    </div>
  );
});
