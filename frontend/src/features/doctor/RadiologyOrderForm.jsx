import React, { useState } from 'react';
import { Scan } from 'lucide-react';
import { addRadiologyOrder } from '../../services/visitService';
import Alert from '../../components/ui/Alert';

const IMAGING_TYPES = ['X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'PET Scan', 'Fluoroscopy', 'Mammography', 'DEXA'];

export default function RadiologyOrderForm({ visit, token, onSaved, readOnly }) {
  const [form, setForm] = useState({ imaging_type: 'X-Ray', body_region: '', clinical_indication: '' });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const orders = visit.radiology_orders || [];
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.body_region.trim() || !form.clinical_indication.trim())
      return setErrorMsg('Body region and clinical indication are required.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await addRadiologyOrder(token, visit.id, form);
      setForm({ imaging_type: 'X-Ray', body_region: '', clinical_indication: '' });
      setSuccessMsg('Radiology order created.'); onSaved?.();
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  const statusBg    = { PENDING: '#fef3c7', VISIBLE_TO_RADIOLOGY: '#dbeafe', COMPLETED: '#d1fae5' };
  const statusColor = { PENDING: '#92400e', VISIBLE_TO_RADIOLOGY: '#1e40af', COMPLETED: '#065f46' };

  return (
    <div>
      <Alert type="error" message={errorMsg} />
      <Alert type="success" message={successMsg} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {orders.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px' }}>No radiology orders yet.</p>}
        {orders.map(o => (
          <div key={o.id} style={{
            padding: '10px 14px', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{o.imaging_type}</span>
                <span style={{ fontSize: '12px', color: '#475569', marginLeft: '8px' }}>— {o.body_region}</span>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>{o.clinical_indication}</p>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                background: statusBg[o.status] || '#f1f5f9', color: statusColor[o.status] || '#334155',
              }}>
                {o.status === 'VISIBLE_TO_RADIOLOGY' ? 'Sent to Radiology' : o.status}
              </span>
            </div>
          </div>
        ))}
      </div>
      {!readOnly && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', alignItems: 'end' }}>
          <div>
            <label className="form-label">Imaging Type</label>
            <select className="form-input" style={{ padding: '9px 12px', background: '#f8fafc' }}
              value={form.imaging_type} onChange={set('imaging_type')}>
              {IMAGING_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Body Region *</label>
            <input type="text" className="form-input" style={{ padding: '9px 12px' }}
              placeholder="e.g. Chest" value={form.body_region} onChange={set('body_region')} />
          </div>
          <div>
            <label className="form-label">Clinical Indication *</label>
            <input type="text" className="form-input" style={{ padding: '9px 12px' }}
              placeholder="Reason for imaging…" value={form.clinical_indication} onChange={set('clinical_indication')} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button onClick={handleSave} disabled={saving}
              className="submit-btn" style={{ padding: '9px', width: 'auto', paddingLeft: 20, paddingRight: 20 }}>
              <Scan size={14} /> {saving ? 'Saving…' : 'Add Radiology Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
