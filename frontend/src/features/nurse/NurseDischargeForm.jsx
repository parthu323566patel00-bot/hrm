import React, { useState } from 'react';
import { LogOut, CheckCircle2 } from 'lucide-react';
import { submitDischargeChecklist } from '../../services/nurseService';
import Alert from '../../components/ui/Alert';

const CHECKLIST = [
  'Patient briefed on discharge instructions',
  'Discharge summary handed to patient',
  'Medications explained',
  'Follow-up appointment scheduled',
  'IV/catheter removed',
  'Vital signs stable on discharge',
  'Personal belongings returned',
  'Bed cleaned and sanitised',
];

export default function NurseDischargeForm({ token, visitId, onSaved, isCompleted }) {
  const [checked, setChecked]       = useState(new Set());
  const [bedNumber, setBedNumber]   = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [done, setDone]             = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');

  const toggle = (item) => setChecked(prev => {
    const next = new Set(prev);
    next.has(item) ? next.delete(item) : next.add(item);
    return next;
  });

  const handleSubmit = async () => {
    setSaving(true); setErrorMsg('');
    try {
      const checklistText = [...checked].join('\n');
      await submitDischargeChecklist(token, visitId, {
        checklist_notes: [checklistText, notes].filter(Boolean).join('\n---\n') || null,
        bed_number: bedNumber.trim() || null,
      });
      setDone(true);
      onSaved('Discharge checklist submitted. Bed released.');
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  if (!isCompleted)
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
        <LogOut size={32} style={{ marginBottom: '10px', opacity: 0.3 }} />
        <p style={{ fontSize: '13px' }}>Available after the doctor completes the consultation.</p>
      </div>
    );

  if (done)
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <CheckCircle2 size={48} style={{ color: '#10b981', marginBottom: '12px' }} />
        <p style={{ fontWeight: 700, fontSize: '16px', color: '#065f46' }}>Discharge Completed</p>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>Bed released. Admission closed.</p>
      </div>
    );

  return (
    <div>
      <Alert type="error" message={errorMsg} />

      <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>
        Discharge Checklist
      </p>

      {/* Checklist items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {CHECKLIST.map(item => (
          <label key={item} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
            background: checked.has(item) ? 'rgba(99,102,241,0.06)' : '#f8fafc',
            border: `1.5px solid ${checked.has(item) ? '#6366f1' : '#e2e8f0'}`,
            transition: 'all .15s',
          }}>
            <input type="checkbox" checked={checked.has(item)}
              onChange={() => toggle(item)}
              style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }} />
            <span style={{ fontSize: '13px', color: checked.has(item) ? '#4338ca' : '#334155', fontWeight: checked.has(item) ? 600 : 400 }}>
              {item}
            </span>
          </label>
        ))}
      </div>

      {/* Bed number */}
      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label className="form-label">Bed Number <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
        <input type="text" className="form-input" style={{ padding: '9px 12px' }}
          placeholder="e.g. Ward 3 - Bed 12"
          value={bedNumber} onChange={e => setBedNumber(e.target.value)} />
      </div>

      {/* Additional notes */}
      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label className="form-label">Additional Notes <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
        <textarea className="form-input" style={{ padding: '9px 12px', resize: 'vertical', minHeight: '60px' }}
          placeholder="Any additional discharge notes…"
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <button onClick={handleSubmit} disabled={saving}
        className="submit-btn"
        style={{
          padding: '11px', background: 'linear-gradient(135deg,#10b981,#059669)',
          boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
        }}>
        <LogOut size={15} /> {saving ? 'Submitting…' : 'Release Bed & Close Admission'}
      </button>
    </div>
  );
}
