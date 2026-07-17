import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { recordVitals } from '../../services/nurseService';
import Alert from '../../components/ui/Alert';

const FIELDS = [
  { key: 'systolic_bp',      label: 'Systolic BP',   unit: 'mmHg', type: 'number' },
  { key: 'diastolic_bp',     label: 'Diastolic BP',  unit: 'mmHg', type: 'number' },
  { key: 'heart_rate',       label: 'Heart Rate',    unit: 'bpm',  type: 'number' },
  { key: 'temperature',      label: 'Temperature',   unit: '°C',   type: 'number', step: '0.1' },
  { key: 'spo2',             label: 'SpO₂',          unit: '%',    type: 'number', step: '0.1' },
  { key: 'respiratory_rate', label: 'Resp. Rate',    unit: 'br/m', type: 'number' },
  { key: 'weight_kg',        label: 'Weight',        unit: 'kg',   type: 'number', step: '0.1' },
  { key: 'height_cm',        label: 'Height',        unit: 'cm',   type: 'number', step: '0.1' },
];

const empty = () => Object.fromEntries(FIELDS.map(f => [f.key, '']));

export default function NurseVitalsForm({ token, visitId, onSaved, isActive, vitalsHistory }) {
  const [form, setForm]       = useState(empty());
  const [saving, setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = async () => {
    const payload = {};
    FIELDS.forEach(f => { if (form[f.key] !== '') payload[f.key] = parseFloat(form[f.key]); });
    if (!Object.keys(payload).length) return setErrorMsg('Enter at least one vitals value.');
    setSaving(true); setErrorMsg('');
    try {
      await recordVitals(token, visitId, payload);
      setForm(empty());
      onSaved('Vitals recorded successfully.');
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Alert type="error" message={errorMsg} />

      {/* History */}
      {vitalsHistory.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
            Previous Recordings
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
            {[...vitalsHistory].reverse().map(v => (
              <div key={v.id} style={{
                padding: '9px 12px', background: '#f8fafc', borderRadius: '8px',
                border: '1px solid #e2e8f0', fontSize: '12px', color: '#334155',
                display: 'flex', gap: '14px', flexWrap: 'wrap',
              }}>
                {FIELDS.map(f => v[f.key] != null && (
                  <span key={f.key}><strong>{f.label}:</strong> {v[f.key]} {f.unit}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New vitals entry */}
      {isActive ? (
        <>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>
            Record New Vitals
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '16px' }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  {f.label} <span style={{ color: '#94a3b8' }}>({f.unit})</span>
                </label>
                <input type={f.type} step={f.step || '1'}
                  className="form-input" style={{ padding: '8px 10px' }}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder="—" />
              </div>
            ))}
          </div>
          <button onClick={handleSave} disabled={saving} className="submit-btn"
            style={{ padding: '9px', width: 'auto', paddingLeft: 20, paddingRight: 20,
              background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <Activity size={14} /> {saving ? 'Saving…' : 'Save Vitals'}
          </button>
        </>
      ) : (
        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '8px' }}>
          Vitals can only be recorded during an active consultation.
        </p>
      )}
    </div>
  );
}
