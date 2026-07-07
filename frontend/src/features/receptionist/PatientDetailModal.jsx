/**
 * features/receptionist/PatientDetailModal.jsx
 * ----------------------------------------------
 * Full-screen overlay modal showing all patient details.
 * Toggles between VIEW mode and EDIT mode inline.
 *
 * Props:
 *   patient   - Patient object to display
 *   token     - JWT bearer token
 *   onClose   - Called when the modal is dismissed
 *   onUpdated - Called with the updated patient object after a successful save
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Edit2, Save, XCircle,
  User, Phone, Mail, MapPin, Droplets,
  AlertTriangle, FileText, Calendar, Hash,
} from 'lucide-react';
import { updatePatient } from '../../services/patientService';
import Alert from '../../components/ui/Alert';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS   = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const GENDER_COLORS = {
  Male:   { bg: '#dbeafe', color: '#1d4ed8' },
  Female: { bg: '#fce7f3', color: '#9d174d' },
  Other:  { bg: '#f3f4f6', color: '#374151' },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Small read-only detail row ────────────────────────────────────────────────
function DetailRow({ icon: Icon, label, value, highlight }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '10px 0', borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '8px',
        background: 'var(--color-primary-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={15} color="var(--color-primary)" />
      </div>
      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {label}
        </p>
        <p style={{ fontSize: '14px', color: highlight ? '#b45309' : '#0f172a', fontWeight: value ? 500 : 400, marginTop: '2px' }}>
          {value || <span style={{ color: '#cbd5e1' }}>—</span>}
        </p>
      </div>
    </div>
  );
}

export default function PatientDetailModal({ patient, token, onClose, onUpdated }) {
  const [mode, setMode]         = useState('view');   // 'view' | 'edit'
  const [form, setForm]         = useState({});
  const [saving, setSaving]     = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initialise form from patient prop
  useEffect(() => {
    setForm({
      name:        patient.name        || '',
      age:         patient.age         || '',
      phone:       patient.phone       || '',
      gender:      patient.gender      || '',
      email:       patient.email       || '',
      blood_group: patient.blood_group || '',
      address:     patient.address     || '',
      allergies:   patient.allergies   || '',
      notes:       patient.notes       || '',
    });
  }, [patient]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrorMsg('');
  };

  const handleSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!form.name.trim())  return setErrorMsg('Name is required.');
    if (!form.age)          return setErrorMsg('Age is required.');
    if (!form.phone.trim()) return setErrorMsg('Phone is required.');
    if (!form.gender)       return setErrorMsg('Gender is required.');

    const ageNum = parseInt(form.age, 10);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 150)
      return setErrorMsg('Age must be between 1 and 150.');

    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        age:         ageNum,
        phone:       form.phone.trim(),
        gender:      form.gender,
        email:       form.email.trim()     || null,
        blood_group: form.blood_group      || null,
        address:     form.address.trim()   || null,
        allergies:   form.allergies.trim() || null,
        notes:       form.notes.trim()     || null,
      };
      const updated = await updatePatient(token, patient.id, payload);
      setSuccessMsg('Patient details updated successfully.');
      setMode('view');
      onUpdated(updated);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update patient.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset form to current patient data
    setForm({
      name:        patient.name        || '',
      age:         patient.age         || '',
      phone:       patient.phone       || '',
      gender:      patient.gender      || '',
      email:       patient.email       || '',
      blood_group: patient.blood_group || '',
      address:     patient.address     || '',
      allergies:   patient.allergies   || '',
      notes:       patient.notes       || '',
    });
    setErrorMsg('');
    setSuccessMsg('');
    setMode('view');
  };

  const genderStyle = GENDER_COLORS[patient.gender] || GENDER_COLORS.Other;

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Modal panel — stop propagation so clicking inside doesn't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px rgba(15,23,42,0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#fff', borderRadius: '20px 20px 0 0',
          zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Avatar circle */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--color-primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={20} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  {patient.name}
                </h2>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '1px 8px',
                  borderRadius: '20px', background: genderStyle.bg, color: genderStyle.color,
                }}>
                  {patient.gender}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Patient ID #{patient.id}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {mode === 'view' ? (
              <button
                onClick={() => setMode('edit')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px',
                  background: 'var(--color-primary-light)',
                  border: '1px solid rgba(0,172,193,0.2)',
                  color: 'var(--color-primary)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Edit2 size={14} /> Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '8px',
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    color: '#64748b', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <XCircle size={14} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--color-primary), #00838f)',
                    border: 'none', color: '#fff',
                    fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '8px',
                background: '#f8fafc', border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#64748b',
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px' }}>
          <Alert type="error"   message={errorMsg}   />
          <Alert type="success" message={successMsg} />

          {mode === 'view' ? (
            /* ── VIEW MODE ─────────────────────────────────────────────── */
            <div>
              <DetailRow icon={User}     label="Full Name"    value={patient.name} />
              <DetailRow icon={Hash}     label="Age"          value={`${patient.age} years`} />
              <DetailRow icon={Phone}    label="Phone"        value={patient.phone} />
              <DetailRow icon={User}     label="Gender"       value={patient.gender} />
              <DetailRow icon={Mail}     label="Email"        value={patient.email} />
              <DetailRow icon={Droplets} label="Blood Group"  value={patient.blood_group} />
              <DetailRow icon={MapPin}   label="Address"      value={patient.address} />
              <DetailRow icon={AlertTriangle} label="Allergies" value={patient.allergies} highlight={!!patient.allergies} />
              <DetailRow icon={FileText} label="Notes"        value={patient.notes} />

              {/* Timestamps */}
              <div style={{ marginTop: '16px', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={12} /> Registered: {formatDate(patient.created_at)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={12} /> Updated: {formatDate(patient.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* ── EDIT MODE ─────────────────────────────────────────────── */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

              {/* Name */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                <div className="input-wrapper">
                  <User className="input-icon" size={14} style={{ left: '12px' }} />
                  <input type="text" className="form-input"
                    style={{ padding: '9px 9px 9px 34px' }}
                    value={form.name} onChange={set('name')} required />
                </div>
              </div>

              {/* Age */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Age <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="number" className="form-input"
                  style={{ padding: '9px 14px' }}
                  min={1} max={150}
                  value={form.age} onChange={set('age')} required />
              </div>

              {/* Phone */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Phone <span style={{ color: '#ef4444' }}>*</span></label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={14} style={{ left: '12px' }} />
                  <input type="tel" className="form-input"
                    style={{ padding: '9px 9px 9px 34px' }}
                    value={form.phone} onChange={set('phone')} required />
                </div>
              </div>

              {/* Gender */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Gender <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="form-input"
                  style={{ padding: '9px 14px', background: '#f8fafc' }}
                  value={form.gender} onChange={set('gender')} required>
                  <option value="" disabled>Select gender</option>
                  {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {/* Email */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={14} style={{ left: '12px' }} />
                  <input type="email" className="form-input"
                    style={{ padding: '9px 9px 9px 34px' }}
                    value={form.email} onChange={set('email')} />
                </div>
              </div>

              {/* Blood Group */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Blood Group <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <div className="input-wrapper">
                  <Droplets className="input-icon" size={14} style={{ left: '12px' }} />
                  <select className="form-input"
                    style={{ padding: '9px 9px 9px 34px', background: '#f8fafc' }}
                    value={form.blood_group} onChange={set('blood_group')}>
                    <option value="">Select blood group</option>
                    {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* Address — full width */}
              <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <label className="form-label">Address <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={14} style={{ left: '12px' }} />
                  <input type="text" className="form-input"
                    style={{ padding: '9px 9px 9px 34px' }}
                    value={form.address} onChange={set('address')} />
                </div>
              </div>

              {/* Allergies — full width */}
              <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <label className="form-label">Allergies <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <div className="input-wrapper">
                  <AlertTriangle className="input-icon" size={14} style={{ left: '12px' }} />
                  <input type="text" className="form-input"
                    style={{ padding: '9px 9px 9px 34px' }}
                    value={form.allergies} onChange={set('allergies')} />
                </div>
              </div>

              {/* Notes — full width */}
              <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <label className="form-label">Notes <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <div className="input-wrapper">
                  <FileText className="input-icon" size={14} style={{ left: '12px', top: '11px', alignSelf: 'flex-start' }} />
                  <textarea className="form-input"
                    style={{ padding: '9px 9px 9px 34px', resize: 'vertical', minHeight: '68px' }}
                    value={form.notes} onChange={set('notes')} />
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
