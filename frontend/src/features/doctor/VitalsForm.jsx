import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { saveVitals } from '../../services/visitService';
import Alert from '../../components/ui/Alert';

const FIELDS = [
  { key: 'systolic_bp',      label: 'Systolic BP',      unit: 'mmHg', type: 'number' },
  { key: 'diastolic_bp',     label: 'Diastolic BP',     unit: 'mmHg', type: 'number' },
  { key: 'heart_rate',       label: 'Heart Rate',       unit: 'bpm',  type: 'number' },
  { key: 'temperature',      label: 'Temperature',      unit: '°C',   type: 'number', step: '0.1' },
  { key: 'spo2',             label: 'SpO₂',             unit: '%',    type: 'number', step: '0.1' },
  { key: 'respiratory_rate', label: 'Resp. Rate',       unit: 'br/m', type: 'number' },
  { key: 'weight_kg',        label: 'Weight',           unit: 'kg',   type: 'number', step: '0.1' },
  { key: 'height_cm',        label: 'Height',           unit: 'cm',   type: 'number', step: '0.1' },
];

const empty = () => Object.fromEntries(FIELDS.map(f => [f.key, '']));

export default function VitalsForm({ visit, token, onSaved, readOnly }) {
  const [form, setForm]       = useState(empty());
  const [saving, setSaving]   = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const prior = visit.vitals || [];

  const handleSave = async () => {
    const payload = {};
    FIELDS.forEach(f => { if (form[f.key] !== '') payload[f.key] = parseFloat(form[f.key]); });
    if (!Object.keys(payload).length) return setErrorMsg('Enter at least one vitals value.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await saveVitals(token, visit.id, payload);
      setSuccessMsg('Vitals recorded.');
      setForm(empty());
      onSaved?.();
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Alert type="error" message={errorMsg} />
      <Alert type="success" message={successMsg} />

      {/* Prior vitals */}
      {prior.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
            Recorded Vitals
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {prior.map(v => (
              <div key={v.id} style={{
                padding: '10px 14px', background: '#f8fafc', borderRadius: '10px',
                border: '1px solid #e2e8f0', fontSize: '12px', color: '#334155',
                display: 'flex', gap: '16px', flexWrap: 'wrap',
              }}>
                {FIELDS.map(f => v[f.key] != null && (
                  <span key={f.key}><strong>{f.label}:</strong> {v[f.key]} {f.unit}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New vitals form */}
      {!readOnly && (
        <>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>
            Record New Vitals
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '16px' }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  {f.label} <span style={{ color: '#94a3b8' }}>({f.unit})</span>
                </label>
                <input
                  type={f.type} step={f.step || '1'}
                  className="form-input" style={{ padding: '8px 10px' }}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
          <button onClick={handleSave} disabled={saving}
            className="submit-btn" style={{ padding: '9px', width: 'auto', paddingLeft: 20, paddingRight: 20 }}>
            <Activity size={14} /> {saving ? 'Saving…' : 'Save Vitals'}
          </button>
        </>
      )}
    </div>
  );
}
