/**
 * features/nurse/PreVitalsModal.jsx
 * ------------------------------------
 * Lightweight modal for recording pre-consultation vitals
 * when patient is checked-in but doctor hasn't started yet.
 *
 * Props:
 *   patient - queue row object (appointment_id, patient_name, etc.)
 *   token   - JWT bearer token
 *   onClose - dismiss handler
 *   onSaved - called after successful save (refreshes queue)
 */

import React, { useState, useEffect } from 'react';
import { X, Activity, CheckCircle2 } from 'lucide-react';
import { recordPreVitals } from '../../services/nurseService';
import Alert from '../../components/ui/Alert';

const FIELDS = [
  { key: 'systolic_bp',      label: 'Systolic BP',   unit: 'mmHg' },
  { key: 'diastolic_bp',     label: 'Diastolic BP',  unit: 'mmHg' },
  { key: 'heart_rate',       label: 'Heart Rate',    unit: 'bpm'  },
  { key: 'temperature',      label: 'Temperature',   unit: '°C',  step: '0.1' },
  { key: 'spo2',             label: 'SpO₂',          unit: '%',   step: '0.1' },
  { key: 'respiratory_rate', label: 'Resp. Rate',    unit: 'br/m' },
  { key: 'weight_kg',        label: 'Weight',        unit: 'kg',  step: '0.1' },
  { key: 'height_cm',        label: 'Height',        unit: 'cm',  step: '0.1' },
];

const empty = () => Object.fromEntries(FIELDS.map(f => [f.key, '']));

export default function PreVitalsModal({ patient, token, onClose, onSaved }) {
  const [form, setForm]       = useState(empty());
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async () => {
    const payload = {};
    FIELDS.forEach(f => {
      if (form[f.key] !== '') payload[f.key] = parseFloat(form[f.key]);
    });
    if (!Object.keys(payload).length)
      return setErrorMsg('Enter at least one vitals value.');

    setSaving(true); setErrorMsg('');
    try {
      await recordPreVitals(token, patient.appointment_id, payload);
      setSaved(true);
      onSaved?.('Pre-consultation vitals recorded.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save vitals.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '18px', width: '100%',
          maxWidth: '640px', boxShadow: '0 24px 48px rgba(15,23,42,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'rgba(99,102,241,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={18} color="#6366f1" />
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                Pre-Consultation Vitals
              </p>
              <p style={{ fontSize: '12px', color: '#64748b' }}>
                {patient.patient_name} · {patient.appointment_time}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '7px',
              background: '#f8fafc', border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748b',
            }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px' }}>
          {saved ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle2 size={44} style={{ color: '#10b981', marginBottom: '10px' }} />
              <p style={{ fontWeight: 700, fontSize: '15px', color: '#065f46' }}>
                Vitals Recorded
              </p>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                These will be automatically linked to the patient's chart when the doctor starts the consultation.
              </p>
              <button onClick={onClose}
                style={{
                  marginTop: '16px', padding: '8px 24px', borderRadius: '10px',
                  background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                  color: '#6366f1', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>
                Close
              </button>
            </div>
          ) : (
            <>
              <Alert type="error" message={errorMsg} />
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                Doctor hasn't started yet — recording baseline vitals for handoff.
                These will be visible in the patient chart once consultation begins.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '18px' }}>
                {FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={{
                      fontSize: '11px', fontWeight: 600, color: '#64748b',
                      display: 'block', marginBottom: '4px',
                    }}>
                      {f.label} <span style={{ color: '#94a3b8' }}>({f.unit})</span>
                    </label>
                    <input
                      type="number" step={f.step || '1'}
                      className="form-input" style={{ padding: '8px 10px' }}
                      value={form[f.key]}
                      onChange={e => {
                        const val = e.target.value;
                        setForm(p => ({ ...p, [f.key]: val }));
                        setErrorMsg('');
                      }}
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={onClose}
                  style={{
                    padding: '9px 18px', borderRadius: '10px',
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    color: '#475569', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{
                    padding: '9px 20px', borderRadius: '10px', border: 'none',
                    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff', fontSize: '13px', fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                  <Activity size={14} /> {saving ? 'Saving…' : 'Save Vitals'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
