import React from 'react';
import { User } from 'lucide-react';

export default React.memo(function PatientCard({ patient }) {
  if (!patient || !Object.values(patient).some(Boolean)) return null;
  const rows = [
    patient.name    && ['Name',       patient.name],
    patient.age     && ['Age',        patient.age],
    patient.gender  && ['Gender',     patient.gender],
    patient.dob     && ['Date of Birth', patient.dob],
    patient.id      && ['Patient ID', patient.id],
    patient.phone   && ['Phone',      patient.phone],
    patient.address && ['Address',    patient.address],
  ].filter(Boolean);

  return (
    <div style={{
      padding: '14px 16px', borderRadius: '12px',
      background: '#f0f9ff', border: '1px solid #bae6fd',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <User size={15} color="#0369a1" />
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0369a1' }}>Patient</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{label}: </span>
            <span style={{ fontSize: '12px', color: '#0f172a' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
