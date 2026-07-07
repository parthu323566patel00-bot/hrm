import React from 'react';
import { Calendar, Stethoscope } from 'lucide-react';

export default function PatientHistory({ history }) {
  if (!history.length) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
        <Calendar size={28} style={{ marginBottom: '8px', opacity: 0.3 }} />
        <p style={{ fontSize: '12px' }}>No prior visits.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: '12px' }}>
        Visit History ({history.length})
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {history.map(v => (
          <div key={v.id} style={{
            padding: '10px 12px', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Calendar size={11} color="var(--color-primary)" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                {new Date(v.started_at).toLocaleDateString('en-US', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            </div>
            {v.primary_diagnosis && (
              <p style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600,
                display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                <Stethoscope size={11} style={{ marginTop: '2px', flexShrink: 0 }} />
                {v.primary_diagnosis}
              </p>
            )}
            <span style={{
              fontSize: '10px', color: '#10b981', fontWeight: 700,
              background: '#d1fae5', padding: '1px 6px', borderRadius: '10px',
              display: 'inline-block', marginTop: '4px',
            }}>
              {v.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
