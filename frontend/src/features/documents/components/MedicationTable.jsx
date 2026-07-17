import React from 'react';
import { Pill } from 'lucide-react';

export default React.memo(function MedicationTable({ medications = [] }) {
  if (!medications.length) return <p style={{ color: '#94a3b8', fontSize: '13px' }}>No medications recorded.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {medications.map((m, i) => (
        <div key={i} style={{
          padding: '12px 16px', borderRadius: '10px',
          background: '#fefce8', border: '1px solid #fef08a',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <Pill size={16} style={{ color: '#a16207', marginTop: '1px', flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '3px' }}>
              {m.name}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#475569' }}>
              {m.dosage     && <span><strong>Dose:</strong> {m.dosage}</span>}
              {m.frequency  && <span><strong>Frequency:</strong> {m.frequency}</span>}
              {m.duration   && <span><strong>Duration:</strong> {m.duration}</span>}
              {m.route      && <span><strong>Route:</strong> {m.route}</span>}
            </div>
            {m.instructions && (
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                {m.instructions}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});
