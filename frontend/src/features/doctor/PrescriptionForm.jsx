import React, { useState } from 'react';
import { Pill } from 'lucide-react';
import { addPrescription } from '../../services/visitService';
import Alert from '../../components/ui/Alert';

const ROUTES = ['Oral', 'IV', 'IM', 'Subcutaneous', 'Topical', 'Inhalation', 'Sublingual', 'Rectal'];
const empty = () => ({ medication_name: '', dosage: '', frequency: '', duration: '', route: 'Oral', instructions: '' });

export default function PrescriptionForm({ visit, token, onSaved, readOnly }) {
  const [form, setForm]   = useState(empty());
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const rxs = visit.prescriptions || [];

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.medication_name.trim() || !form.dosage.trim() || !form.frequency.trim() || !form.duration.trim())
      return setErrorMsg('Medication, dosage, frequency and duration are required.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await addPrescription(token, visit.id, {
        ...form,
        instructions: form.instructions.trim() || null,
      });
      setForm(empty()); setSuccessMsg('Prescription added.'); onSaved?.();
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  const statusColor = { DRAFT: '#64748b', AVAILABLE_TO_PHARMACY: '#065f46' };
  const statusBg    = { DRAFT: '#f1f5f9', AVAILABLE_TO_PHARMACY: '#d1fae5' };

  return (
    <div>
      <Alert type="error" message={errorMsg} />
      <Alert type="success" message={successMsg} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {rxs.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px' }}>No prescriptions yet.</p>}
        {rxs.map(r => (
          <div key={r.id} style={{
            padding: '12px 14px', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{r.medication_name}</span>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                background: statusBg[r.status] || '#f1f5f9',
                color: statusColor[r.status] || '#334155',
              }}>
                {r.status === 'AVAILABLE_TO_PHARMACY' ? 'Sent to Pharmacy' : 'Draft'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
              {r.dosage} · {r.frequency} · {r.duration} · {r.route}
              {r.instructions && <> · <em>{r.instructions}</em></>}
            </p>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
          {[
            { k: 'medication_name', label: 'Medication *', placeholder: 'e.g. Amoxicillin' },
            { k: 'dosage',   label: 'Dosage *',   placeholder: '500mg' },
            { k: 'frequency',label: 'Frequency *', placeholder: 'TDS' },
            { k: 'duration', label: 'Duration *',  placeholder: '7 days' },
          ].map(({ k, label, placeholder }) => (
            <div key={k}>
              <label className="form-label">{label}</label>
              <input type="text" className="form-input" style={{ padding: '8px 10px' }}
                placeholder={placeholder} value={form[k]} onChange={set(k)} />
            </div>
          ))}
          <div>
            <label className="form-label">Route</label>
            <select className="form-input" style={{ padding: '8px 10px', background: '#f8fafc' }}
              value={form.route} onChange={set('route')}>
              {ROUTES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Instructions <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
            <input type="text" className="form-input" style={{ padding: '8px 10px' }}
              placeholder="Take with food" value={form.instructions} onChange={set('instructions')} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button onClick={handleSave} disabled={saving}
              className="submit-btn" style={{ padding: '9px', width: 'auto', paddingLeft: 20, paddingRight: 20 }}>
              <Pill size={14} /> {saving ? 'Saving…' : 'Add Prescription'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
