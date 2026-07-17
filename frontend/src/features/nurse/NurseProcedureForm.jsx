import React, { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { logProcedure } from '../../services/nurseService';
import Alert from '../../components/ui/Alert';

const QUICK_PROCEDURES = [
  'IV drip inserted',
  'Blood sample collected',
  'Urine sample collected',
  'Blood pressure medication administered',
  'Wound dressing changed',
  'Catheter inserted',
  'Oxygen therapy started',
  'Patient repositioned',
];

export default function NurseProcedureForm({ token, visitId, onSaved, isActive }) {
  const [description, setDescription] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = async () => {
    if (!description.trim()) return setErrorMsg('Procedure description is required.');
    setSaving(true); setErrorMsg('');
    try {
      await logProcedure(token, visitId, {
        description: description.trim(),
        observation: observation.trim() || null,
      });
      setDescription(''); setObservation('');
      onSaved('Procedure logged.');
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  if (!isActive)
    return <p style={{ color: '#94a3b8', fontSize: '13px' }}>Only available during an active consultation.</p>;

  return (
    <div>
      <Alert type="error" message={errorMsg} />

      {/* Quick selection */}
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
        Quick Select
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {QUICK_PROCEDURES.map(p => (
          <button key={p} onClick={() => setDescription(p)}
            style={{
              padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              border: `1.5px solid ${description === p ? '#6366f1' : '#e2e8f0'}`,
              background: description === p ? 'rgba(99,102,241,0.08)' : '#f8fafc',
              color: description === p ? '#6366f1' : '#475569',
              cursor: 'pointer', transition: 'all .15s',
            }}>
            {p}
          </button>
        ))}
      </div>

      {/* Or type custom */}
      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label className="form-label">Procedure Description *</label>
        <input type="text" className="form-input" style={{ padding: '9px 12px' }}
          placeholder="Describe the procedure performed…"
          value={description}
          onChange={e => { setDescription(e.target.value); setErrorMsg(''); }} />
      </div>

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label className="form-label">Observation <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
        <textarea className="form-input" style={{ padding: '9px 12px', resize: 'vertical', minHeight: '60px' }}
          placeholder="Patient response, any complications…"
          value={observation}
          onChange={e => setObservation(e.target.value)} />
      </div>

      <button onClick={handleSave} disabled={saving} className="submit-btn"
        style={{ padding: '9px', width: 'auto', paddingLeft: 20, paddingRight: 20,
          background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
        <Stethoscope size={14} /> {saving ? 'Saving…' : 'Log Procedure'}
      </button>
    </div>
  );
}
