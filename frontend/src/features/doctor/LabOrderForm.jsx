import React, { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { addLabOrder } from '../../services/visitService';
import Alert from '../../components/ui/Alert';

const statusColor = { PENDING:'#92400e', VISIBLE_TO_LAB:'#1e40af', IN_PROGRESS:'#1d4ed8', COMPLETED:'#065f46' };
const statusBg    = { PENDING:'#fef3c7', VISIBLE_TO_LAB:'#dbeafe', IN_PROGRESS:'#eff6ff', COMPLETED:'#d1fae5' };

export default function LabOrderForm({ visit, token, onSaved, readOnly }) {
  const [testName, setTestName] = useState('');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const orders = visit.lab_orders || [];

  const handleSave = async () => {
    if (!testName.trim()) return setErrorMsg('Test name is required.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await addLabOrder(token, visit.id, { test_name: testName.trim(), clinical_notes: notes.trim() || null });
      setTestName(''); setNotes(''); setSuccessMsg('Lab order created.'); onSaved?.();
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Alert type="error" message={errorMsg} />
      <Alert type="success" message={successMsg} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {orders.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px' }}>No lab orders yet.</p>}
        {orders.map(o => (
          <div key={o.id} style={{
            padding: '10px 14px', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: '10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{o.test_name}</span>
              {o.clinical_notes && <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{o.clinical_notes}</p>}
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
              background: statusBg[o.status] || '#f1f5f9', color: statusColor[o.status] || '#334155',
            }}>
              {o.status === 'VISIBLE_TO_LAB' ? 'Sent to Lab' : o.status}
            </span>
          </div>
        ))}
      </div>
      {!readOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label className="form-label">Test Name *</label>
            <input type="text" className="form-input" style={{ padding: '9px 12px' }}
              placeholder="e.g. Complete Blood Count" value={testName}
              onChange={e => setTestName(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Clinical Notes <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
            <input type="text" className="form-input" style={{ padding: '9px 12px' }}
              placeholder="Reason for test…" value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="submit-btn" style={{ padding: '9px', width: 'auto', paddingLeft: 20, paddingRight: 20 }}>
            <FlaskConical size={14} /> {saving ? 'Saving…' : 'Add Lab Order'}
          </button>
        </div>
      )}
    </div>
  );
}
