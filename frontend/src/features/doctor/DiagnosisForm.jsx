import React, { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { addDiagnosis } from '../../services/visitService';
import Alert from '../../components/ui/Alert';

const SEVERITIES = ['mild', 'moderate', 'severe'];

export default function DiagnosisForm({ visit, token, onSaved, readOnly }) {
  const [form, setForm] = useState({ icd_code: '', description: '', severity: 'moderate' });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const diagnoses = visit.diagnoses || [];

  const handleSave = async () => {
    if (!form.description.trim()) return setErrorMsg('Description is required.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await addDiagnosis(token, visit.id, {
        icd_code: form.icd_code.trim() || null,
        description: form.description.trim(),
        severity: form.severity,
      });
      setForm({ icd_code: '', description: '', severity: 'moderate' });
      setSuccessMsg('Diagnosis saved.'); onSaved?.();
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  const severityColor = { mild: '#065f46', moderate: '#92400e', severe: '#991b1b' };
  const severityBg    = { mild: '#d1fae5', moderate: '#fef3c7', severe: '#fee2e2' };

  return (
    <div>
      <Alert type="error" message={errorMsg} />
      <Alert type="success" message={successMsg} />

      {/* Existing diagnoses */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {diagnoses.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px' }}>No diagnoses yet.</p>}
        {diagnoses.map(d => (
          <div key={d.id} style={{
            padding: '12px 14px', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: '10px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          }}>
            <div>
              {d.icd_code && <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginRight: '8px' }}>[{d.icd_code}]</span>}
              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{d.description}</span>
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
              background: severityBg[d.severity] || '#f1f5f9',
              color: severityColor[d.severity] || '#374151',
            }}>
              {d.severity}
            </span>
          </div>
        ))}
      </div>

      {/* New diagnosis */}
      {!readOnly && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '12px', alignItems: 'end' }}>
          <div>
            <label className="form-label">ICD Code <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
            <input type="text" className="form-input" style={{ padding: '9px 12px' }}
              placeholder="e.g. J06.9" value={form.icd_code}
              onChange={e => setForm(p => ({ ...p, icd_code: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Description *</label>
            <input type="text" className="form-input" style={{ padding: '9px 12px' }}
              placeholder="Primary diagnosis…" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Severity</label>
            <select className="form-input" style={{ padding: '9px 12px', background: '#f8fafc' }}
              value={form.severity}
              onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button onClick={handleSave} disabled={saving}
              className="submit-btn" style={{ padding: '9px', width: 'auto', paddingLeft: 20, paddingRight: 20 }}>
              <Stethoscope size={14} /> {saving ? 'Saving…' : 'Add Diagnosis'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
