/**
 * features/receptionist/RegisterPatientForm.jsx
 * ------------------------------------------------
 * Form for registering a new patient.
 * Required: name, age, phone, gender
 * Optional: email, blood_group, address, allergies, notes
 *
 * Props:
 *   token     - JWT bearer token
 *   onSuccess - Called with the newly created patient object
 */

import React, { useState } from 'react';
import { UserPlus, User, Phone, Mail, MapPin, Droplets, AlertTriangle, FileText } from 'lucide-react';
import { createPatient } from '../../services/patientService';
import Alert from '../../components/ui/Alert';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS   = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const initialForm = {
  name: '', age: '', phone: '', gender: '',
  email: '', blood_group: '', address: '', allergies: '', notes: '',
};

export default function RegisterPatientForm({ token, onSuccess }) {
  const [form, setForm]       = useState(initialForm);
  const [errorMsg, setErrorMsg]   = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading]   = useState(false);

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Guard: don't call API if token is missing
    if (!token) {
      return setErrorMsg('Authentication required. Please log in.');
    }

    // Client-side required field validation
    if (!form.name.trim())   return setErrorMsg('Patient name is required.');
    if (!form.age)           return setErrorMsg('Age is required.');
    if (!form.phone.trim())  return setErrorMsg('Phone number is required.');
    if (!form.gender)        return setErrorMsg('Gender is required.');

    const ageNum = parseInt(form.age, 10);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 150)
      return setErrorMsg('Please enter a valid age (1–150).');

    setLoading(true);
    try {
      const payload = {
        name:        form.name.trim(),
        age:         ageNum,
        phone:       form.phone.trim(),
        gender:      form.gender,
        email:       form.email.trim()      || null,
        blood_group: form.blood_group       || null,
        address:     form.address.trim()    || null,
        allergies:   form.allergies.trim()  || null,
        notes:       form.notes.trim()      || null,
      };
      const patient = await createPatient(token, payload);
      setSuccessMsg(`Patient "${patient.name}" registered successfully (ID: #${patient.id}).`);
      setForm(initialForm);
      onSuccess(patient);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to register patient.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <h3><UserPlus size={18} /> Register New Patient</h3>
      </div>

      <form onSubmit={handleSubmit}>
        <Alert type="error"   message={errorMsg}   />
        <Alert type="success" message={successMsg} />

        {/* Two-column grid for the form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

          {/* Name — required */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-wrapper">
              <User className="input-icon" size={15} style={{ left: '12px' }} />
              <input
                type="text"
                className="form-input"
                style={{ padding: '10px 10px 10px 36px' }}
                placeholder="e.g. John Smith"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>
          </div>

          {/* Age — required */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Age <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-wrapper">
              <input
                type="number"
                className="form-input"
                style={{ padding: '10px 14px' }}
                placeholder="e.g. 35"
                min={1}
                max={150}
                value={form.age}
                onChange={set('age')}
                required
              />
            </div>
          </div>

          {/* Phone — required */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-wrapper">
              <Phone className="input-icon" size={15} style={{ left: '12px' }} />
              <input
                type="tel"
                className="form-input"
                style={{ padding: '10px 10px 10px 36px' }}
                placeholder="+1 555 000 0000"
                value={form.phone}
                onChange={set('phone')}
                required
              />
            </div>
          </div>

          {/* Gender — required */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Gender <span style={{ color: '#ef4444' }}>*</span></label>
            <select
              className="form-input"
              style={{ padding: '10px 14px', background: '#f8fafc' }}
              value={form.gender}
              onChange={set('gender')}
              required
            >
              <option value="" disabled>Select gender</option>
              {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Email — optional */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={15} style={{ left: '12px' }} />
              <input
                type="email"
                className="form-input"
                style={{ padding: '10px 10px 10px 36px' }}
                placeholder="patient@email.com"
                value={form.email}
                onChange={set('email')}
              />
            </div>
          </div>

          {/* Blood Group — optional */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Blood Group <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
            <div className="input-wrapper">
              <Droplets className="input-icon" size={15} style={{ left: '12px' }} />
              <select
                className="form-input"
                style={{ padding: '10px 10px 10px 36px', background: '#f8fafc' }}
                value={form.blood_group}
                onChange={set('blood_group')}
              >
                <option value="">Select blood group</option>
                {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Address — optional, spans full width */}
          <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
            <label className="form-label">Address <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
            <div className="input-wrapper">
              <MapPin className="input-icon" size={15} style={{ left: '12px', top: '12px', alignSelf: 'flex-start' }} />
              <input
                type="text"
                className="form-input"
                style={{ padding: '10px 10px 10px 36px' }}
                placeholder="Street, City, State"
                value={form.address}
                onChange={set('address')}
              />
            </div>
          </div>

          {/* Allergies — optional, spans full width */}
          <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
            <label className="form-label">Allergies <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
            <div className="input-wrapper">
              <AlertTriangle className="input-icon" size={15} style={{ left: '12px', top: '12px', alignSelf: 'flex-start' }} />
              <input
                type="text"
                className="form-input"
                style={{ padding: '10px 10px 10px 36px' }}
                placeholder="e.g. Penicillin, Peanuts"
                value={form.allergies}
                onChange={set('allergies')}
              />
            </div>
          </div>

          {/* Notes — optional, spans full width */}
          <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
            <label className="form-label">Notes <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
            <div className="input-wrapper">
              <FileText className="input-icon" size={15} style={{ left: '12px', top: '12px', alignSelf: 'flex-start' }} />
              <textarea
                className="form-input"
                style={{ padding: '10px 10px 10px 36px', resize: 'vertical', minHeight: '72px' }}
                placeholder="Any additional notes about the patient..."
                value={form.notes}
                onChange={set('notes')}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="submit-btn"
          style={{ marginTop: '18px', padding: '11px' }}
          disabled={loading}
        >
          {loading ? 'Registering…' : <><UserPlus size={16} /> Register Patient</>}
        </button>
      </form>
    </div>
  );
}
