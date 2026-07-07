/**
 * features/receptionist/BookAppointmentModal.jsx
 * -------------------------------------------------
 * Multi-step appointment booking modal.
 *
 * Step 1 — Patient lookup (name + phone)
 * Step 2 — Department → Doctor selection
 * Step 3 — Date + time slot picker
 * Step 4 — Notes + report file upload → confirm
 *
 * Props:
 *   token     - JWT bearer token
 *   onClose   - called when modal is dismissed
 *   onBooked  - called with the new appointment after successful booking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Search, ChevronRight, ChevronLeft, Calendar,
  Clock, User, Stethoscope, Building2, FileUp,
  CheckCircle, AlertTriangle, Users, UserPlus,
  Phone, Mail, MapPin, Droplets, FileText,
} from 'lucide-react';
import { listPatients, createPatient } from '../../services/patientService';
import { apiFetch } from '../../services/api';
import {
  fetchDoctorsByDept, fetchAllDoctors,
  fetchSlots, bookAppointment,
} from '../../services/appointmentService';
import Alert from '../../components/ui/Alert';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTS  = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS   = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const EMPTY_NEW_PATIENT = {
  name: '', age: '', phone: '', gender: '',
  email: '', blood_group: '', address: '', allergies: '', notes: '',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Generate next 14 days as date options
function getNext14Days() {
  const arr = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    arr.push(d.toISOString().split('T')[0]);
  }
  return arr;
}

export default function BookAppointmentModal({ token, onClose, onBooked }) {
  const [step, setStep] = useState(1); // 1=patient, 2=dept+doctor, 3=date+time, 4=notes+upload

  // Step 1: patient search
  const [patientQuery, setPatientQuery] = useState('');
  const [patients, setPatients]         = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Step 1: inline new-patient form
  const [showAddPatient, setShowAddPatient]   = useState(false);
  const [newPatient, setNewPatient]           = useState(EMPTY_NEW_PATIENT);
  const [addingPatient, setAddingPatient]     = useState(false);
  const [addPatientError, setAddPatientError] = useState('');

  // Step 2: department + doctor
  const [departments, setDepartments]         = useState([]);
  const [selectedDept, setSelectedDept]       = useState(null);
  const [deptDoctors, setDeptDoctors]         = useState([]);
  const [showAllDoctors, setShowAllDoctors]   = useState(false);
  const [allDoctors, setAllDoctors]           = useState([]);
  const [selectedDoctor, setSelectedDoctor]   = useState(null);
  const [loadingDoctors, setLoadingDoctors]   = useState(false);

  // Step 3: date + slot
  const [selectedDate, setSelectedDate]   = useState('');
  const [slots, setSlots]                 = useState([]);
  const [selectedSlot, setSelectedSlot]   = useState('');
  const [loadingSlots, setLoadingSlots]   = useState(false);

  // Step 4: notes + files
  const [notes, setNotes]     = useState('');
  const [files, setFiles]     = useState([]);
  const [fileError, setFileError] = useState('');

  // Global
  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [booking, setBooking]       = useState(false);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Load departments once
  useEffect(() => {
    apiFetch('/departments/', {}, token)
      .then(setDepartments)
      .catch(() => {});
  }, [token]);

  // Debounced patient search
  useEffect(() => {
    if (!patientQuery.trim()) { setPatients([]); return; }
    const t = setTimeout(async () => {
      setLoadingPatients(true);
      try {
        const data = await listPatients(token, patientQuery);
        setPatients(data);
      } catch (_) {}
      finally { setLoadingPatients(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [patientQuery, token]);

  // Load doctors when department selected
  useEffect(() => {
    if (!selectedDept) { setDeptDoctors([]); return; }
    setLoadingDoctors(true);
    setShowAllDoctors(false);
    setSelectedDoctor(null);
    fetchDoctorsByDept(token, selectedDept.id)
      .then(setDeptDoctors)
      .catch(() => setDeptDoctors([]))
      .finally(() => setLoadingDoctors(false));
  }, [selectedDept, token]);

  // Load slots when doctor + date chosen
  useEffect(() => {
    if (!selectedDoctor || !selectedDate) { setSlots([]); return; }
    setLoadingSlots(true);
    setSelectedSlot('');
    fetchSlots(token, selectedDoctor.id, selectedDate)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDoctor, selectedDate, token]);

  const loadAllDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const data = await fetchAllDoctors(token);
      setAllDoctors(data);
      setShowAllDoctors(true);
    } catch (_) {}
    finally { setLoadingDoctors(false); }
  };

  const setNp = (field) => (e) => {
    setNewPatient(p => ({ ...p, [field]: e.target.value }));
    setAddPatientError('');
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    setAddPatientError('');
    if (!newPatient.name.trim())  return setAddPatientError('Full name is required.');
    if (!newPatient.age)          return setAddPatientError('Age is required.');
    if (!newPatient.phone.trim()) return setAddPatientError('Phone number is required.');
    if (!newPatient.gender)       return setAddPatientError('Gender is required.');
    const ageNum = parseInt(newPatient.age, 10);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 150)
      return setAddPatientError('Age must be between 1 and 150.');
    setAddingPatient(true);
    try {
      const created = await createPatient(token, {
        name:        newPatient.name.trim(),
        age:         ageNum,
        phone:       newPatient.phone.trim(),
        gender:      newPatient.gender,
        email:       newPatient.email.trim()     || null,
        blood_group: newPatient.blood_group      || null,
        address:     newPatient.address.trim()   || null,
        allergies:   newPatient.allergies.trim() || null,
        notes:       newPatient.notes.trim()     || null,
      });
      // Select the newly created patient and collapse the form
      setSelectedPatient(created);
      setPatientQuery(created.name);
      setPatients([]);
      setShowAddPatient(false);
      setNewPatient(EMPTY_NEW_PATIENT);
    } catch (err) {
      setAddPatientError(err.message || 'Failed to register patient.');
    } finally {
      setAddingPatient(false);
    }
  };

  const handleFileChange = (e) => {
    setFileError('');
    const chosen = Array.from(e.target.files);
    const invalid = chosen.find(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return !ALLOWED_EXTS.includes(ext);
    });
    if (invalid) {
      setFileError(`"${invalid.name}" is not allowed. Use PDF, DOCX, DOC, JPG, or PNG.`);
      e.target.value = '';
      return;
    }
    const tooBig = chosen.find(f => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      setFileError(`"${tooBig.name}" exceeds 5 MB.`);
      e.target.value = '';
      return;
    }
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...chosen.filter(f => !names.has(f.name))];
    });
    e.target.value = '';
  };

  const removeFile = (name) => setFiles(f => f.filter(x => x.name !== name));

  const handleBook = async () => {
    setErrorMsg('');
    setBooking(true);
    try {
      const result = await bookAppointment(token, {
        patient_id:      selectedPatient.id,
        doctor_id:       selectedDoctor.id,
        department_id:   selectedDept?.id || null,
        appointment_date: selectedDate,
        time_slot:       selectedSlot,
        notes:           notes.trim() || null,
      }, files);
      setSuccessMsg('Appointment booked successfully!');
      onBooked(result);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to book appointment.');
    } finally {
      setBooking(false);
    }
  };

  // Styles helpers
  const btnPrimary = {
    display:'flex', alignItems:'center', gap:'6px',
    padding:'9px 18px', borderRadius:'10px',
    background:'linear-gradient(135deg,var(--color-primary),#00838f)',
    border:'none', color:'#fff', fontSize:'13px', fontWeight:700,
    cursor:'pointer',
  };
  const btnSecondary = {
    display:'flex', alignItems:'center', gap:'6px',
    padding:'9px 18px', borderRadius:'10px',
    background:'#f1f5f9', border:'1px solid #e2e8f0',
    color:'#475569', fontSize:'13px', fontWeight:700, cursor:'pointer',
  };

  const doctorsToShow = showAllDoctors ? allDoctors : deptDoctors;

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:1100,
        background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:'#fff', borderRadius:'20px', width:'100%',
          maxWidth:'660px', maxHeight:'90vh', overflowY:'auto',
          boxShadow:'0 25px 50px rgba(15,23,42,0.2)',
          display:'flex', flexDirection:'column',
        }}
      >

        {/* ── Modal Header ─────────────────────────────────────── */}
        <div style={{
          padding:'18px 24px', borderBottom:'1px solid #f1f5f9',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          position:'sticky', top:0, background:'#fff',
          borderRadius:'20px 20px 0 0', zIndex:1,
        }}>
          <div>
            <h2 style={{fontSize:'16px', fontWeight:800, color:'#0f172a'}}>
              Book Appointment
            </h2>
            {/* Step indicator */}
            <div style={{display:'flex', gap:'6px', marginTop:'6px'}}>
              {['Patient','Doctor','Schedule','Confirm'].map((label, i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:'4px'}}>
                  <div style={{
                    width:22, height:22, borderRadius:'50%',
                    background: step > i+1 ? '#10b981' : step === i+1 ? 'var(--color-primary)' : '#e2e8f0',
                    color: step >= i+1 ? '#fff' : '#94a3b8',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'11px', fontWeight:800, flexShrink:0,
                  }}>
                    {step > i+1 ? '✓' : i+1}
                  </div>
                  <span style={{fontSize:'11px', color: step===i+1 ? 'var(--color-primary)' : '#94a3b8', fontWeight:600}}>
                    {label}
                  </span>
                  {i < 3 && <span style={{color:'#e2e8f0', fontSize:'11px'}}>›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{...btnSecondary, padding:'6px 8px'}}>
            <X size={16}/>
          </button>
        </div>

        {/* ── Modal Body ───────────────────────────────────────── */}
        <div style={{padding:'24px'}}>
          <Alert type="error"   message={errorMsg}   />
          <Alert type="success" message={successMsg} />

          {/* ════════════════ STEP 1 — Patient ════════════════ */}
          {step === 1 && (
            <div>
              {!showAddPatient ? (
                <>
                  <p style={{fontSize:'13px', color:'#64748b', marginBottom:'14px'}}>
                    Search by patient name or phone number.
                  </p>

                  {/* Search input */}
                  <div className="input-wrapper" style={{marginBottom:'12px'}}>
                    <Search className="input-icon" size={15} style={{left:'12px'}}/>
                    <input
                      type="text" className="form-input"
                      style={{padding:'10px 10px 10px 36px'}}
                      placeholder="Search name or phone…"
                      value={patientQuery}
                      onChange={e => {
                        setPatientQuery(e.target.value);
                        setSelectedPatient(null);
                      }}
                      autoFocus
                    />
                  </div>

                  {/* Loading */}
                  {loadingPatients && (
                    <p style={{fontSize:'12px', color:'#94a3b8', textAlign:'center', padding:'12px 0'}}>Searching…</p>
                  )}

                  {/* Results */}
                  {!loadingPatients && patientQuery.trim() && patients.length > 0 && !selectedPatient && (
                    <div style={{display:'flex', flexDirection:'column', gap:'8px', maxHeight:'240px', overflowY:'auto', marginBottom:'12px'}}>
                      {patients.map(p => (
                        <button key={p.id}
                          onClick={() => { setSelectedPatient(p); setPatientQuery(p.name); setPatients([]); }}
                          style={{
                            textAlign:'left', padding:'12px 14px',
                            border:'1px solid #e2e8f0', borderRadius:'10px',
                            background:'#f8fafc', cursor:'pointer', transition:'all .15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor='var(--color-primary)'; e.currentTarget.style.background='#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.background='#f8fafc'; }}
                        >
                          <div style={{fontWeight:700, fontSize:'14px', color:'#0f172a'}}>{p.name}</div>
                          <div style={{fontSize:'12px', color:'#64748b', marginTop:'2px'}}>
                            Age {p.age} · {p.phone}{p.email ? ` · ${p.email}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results → Add Patient button */}
                  {!loadingPatients && patientQuery.trim().length >= 2 && patients.length === 0 && !selectedPatient && (
                    <div style={{
                      padding:'16px', borderRadius:'12px', textAlign:'center',
                      background:'#fffbeb', border:'1px dashed #fcd34d',
                      marginBottom:'12px',
                    }}>
                      <p style={{fontSize:'13px', color:'#92400e', marginBottom:'10px', fontWeight:600}}>
                        No patient found for "{patientQuery}"
                      </p>
                      <button
                        onClick={() => {
                          setShowAddPatient(true);
                          setNewPatient({ ...EMPTY_NEW_PATIENT, name: patientQuery });
                        }}
                        style={{
                          display:'inline-flex', alignItems:'center', gap:'7px',
                          padding:'9px 18px', borderRadius:'10px',
                          background:'linear-gradient(135deg,var(--color-primary),#00838f)',
                          border:'none', color:'#fff', fontSize:'13px', fontWeight:700,
                          cursor:'pointer',
                        }}
                      >
                        <UserPlus size={15}/> Add New Patient
                      </button>
                    </div>
                  )}

                  {/* Selected patient confirmation */}
                  {selectedPatient && (
                    <div style={{
                      padding:'12px 14px', borderRadius:'10px',
                      background:'var(--color-primary-light)',
                      border:'1px solid rgba(0,172,193,0.2)',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                    }}>
                      <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        <CheckCircle size={18} color="var(--color-primary)"/>
                        <div>
                          <div style={{fontWeight:700, fontSize:'14px', color:'#0f172a'}}>{selectedPatient.name}</div>
                          <div style={{fontSize:'12px', color:'#64748b'}}>Age {selectedPatient.age} · {selectedPatient.phone}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedPatient(null); setPatientQuery(''); }}
                        style={{background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'12px'}}
                      >
                        Change
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* ── Inline Add Patient Form ─────────────────────────── */
                <div>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <UserPlus size={16} color="var(--color-primary)"/>
                      <span style={{fontWeight:700, fontSize:'15px', color:'#0f172a'}}>Register New Patient</span>
                    </div>
                    <button
                      onClick={() => { setShowAddPatient(false); setAddPatientError(''); setNewPatient(EMPTY_NEW_PATIENT); }}
                      style={{background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:'12px', fontWeight:600}}
                    >
                      ← Back to search
                    </button>
                  </div>

                  {addPatientError && (
                    <div style={{
                      padding:'10px 14px', borderRadius:'8px', marginBottom:'14px',
                      background:'#fef2f2', border:'1px solid #fecaca',
                      color:'#991b1b', fontSize:'12px', display:'flex', gap:'6px', alignItems:'center',
                    }}>
                      <AlertTriangle size={14}/> {addPatientError}
                    </div>
                  )}

                  <form onSubmit={handleAddPatient}>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>

                      {/* Full Name — required */}
                      <div className="form-group" style={{marginBottom:0}}>
                        <label className="form-label">Full Name <span style={{color:'#ef4444'}}>*</span></label>
                        <div className="input-wrapper">
                          <User className="input-icon" size={14} style={{left:'10px'}}/>
                          <input type="text" className="form-input"
                            style={{padding:'9px 9px 9px 32px'}}
                            placeholder="e.g. John Smith"
                            value={newPatient.name}
                            onChange={setNp('name')} required/>
                        </div>
                      </div>

                      {/* Age — required */}
                      <div className="form-group" style={{marginBottom:0}}>
                        <label className="form-label">Age <span style={{color:'#ef4444'}}>*</span></label>
                        <input type="number" className="form-input"
                          style={{padding:'9px 14px'}}
                          placeholder="e.g. 35" min={1} max={150}
                          value={newPatient.age}
                          onChange={setNp('age')} required/>
                      </div>

                      {/* Phone — required */}
                      <div className="form-group" style={{marginBottom:0}}>
                        <label className="form-label">Phone Number <span style={{color:'#ef4444'}}>*</span></label>
                        <div className="input-wrapper">
                          <Phone className="input-icon" size={14} style={{left:'10px'}}/>
                          <input type="tel" className="form-input"
                            style={{padding:'9px 9px 9px 32px'}}
                            placeholder="+1 555 000 0000"
                            value={newPatient.phone}
                            onChange={setNp('phone')} required/>
                        </div>
                      </div>

                      {/* Gender — required */}
                      <div className="form-group" style={{marginBottom:0}}>
                        <label className="form-label">Gender <span style={{color:'#ef4444'}}>*</span></label>
                        <select className="form-input"
                          style={{padding:'9px 14px', background:'#f8fafc'}}
                          value={newPatient.gender}
                          onChange={setNp('gender')} required>
                          <option value="" disabled>Select gender</option>
                          {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>

                      {/* Email — optional */}
                      <div className="form-group" style={{marginBottom:0}}>
                        <label className="form-label">Email <span style={{color:'#94a3b8', fontWeight:400}}>(optional)</span></label>
                        <div className="input-wrapper">
                          <Mail className="input-icon" size={14} style={{left:'10px'}}/>
                          <input type="email" className="form-input"
                            style={{padding:'9px 9px 9px 32px'}}
                            placeholder="patient@email.com"
                            value={newPatient.email}
                            onChange={setNp('email')}/>
                        </div>
                      </div>

                      {/* Blood Group — optional */}
                      <div className="form-group" style={{marginBottom:0}}>
                        <label className="form-label">Blood Group <span style={{color:'#94a3b8', fontWeight:400}}>(optional)</span></label>
                        <div className="input-wrapper">
                          <Droplets className="input-icon" size={14} style={{left:'10px'}}/>
                          <select className="form-input"
                            style={{padding:'9px 9px 9px 32px', background:'#f8fafc'}}
                            value={newPatient.blood_group}
                            onChange={setNp('blood_group')}>
                            <option value="">Select blood group</option>
                            {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Address — full width */}
                      <div className="form-group" style={{marginBottom:0, gridColumn:'1 / -1'}}>
                        <label className="form-label">Address <span style={{color:'#94a3b8', fontWeight:400}}>(optional)</span></label>
                        <div className="input-wrapper">
                          <MapPin className="input-icon" size={14} style={{left:'10px'}}/>
                          <input type="text" className="form-input"
                            style={{padding:'9px 9px 9px 32px'}}
                            placeholder="Street, City, State"
                            value={newPatient.address}
                            onChange={setNp('address')}/>
                        </div>
                      </div>

                      {/* Allergies — full width */}
                      <div className="form-group" style={{marginBottom:0, gridColumn:'1 / -1'}}>
                        <label className="form-label">Allergies <span style={{color:'#94a3b8', fontWeight:400}}>(optional)</span></label>
                        <div className="input-wrapper">
                          <AlertTriangle className="input-icon" size={14} style={{left:'10px'}}/>
                          <input type="text" className="form-input"
                            style={{padding:'9px 9px 9px 32px'}}
                            placeholder="e.g. Penicillin, Peanuts"
                            value={newPatient.allergies}
                            onChange={setNp('allergies')}/>
                        </div>
                      </div>

                      {/* Notes — full width */}
                      <div className="form-group" style={{marginBottom:0, gridColumn:'1 / -1'}}>
                        <label className="form-label">Notes <span style={{color:'#94a3b8', fontWeight:400}}>(optional)</span></label>
                        <div className="input-wrapper">
                          <FileText className="input-icon" size={14} style={{left:'10px', top:'10px', alignSelf:'flex-start'}}/>
                          <textarea className="form-input"
                            style={{padding:'9px 9px 9px 32px', resize:'vertical', minHeight:'60px'}}
                            placeholder="Any additional notes…"
                            value={newPatient.notes}
                            onChange={setNp('notes')}/>
                        </div>
                      </div>

                    </div>{/* end grid */}

                    <button type="submit" className="submit-btn"
                      style={{marginTop:'16px', padding:'10px'}}
                      disabled={addingPatient}>
                      {addingPatient
                        ? 'Registering…'
                        : <><UserPlus size={15}/> Register & Select Patient</>}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ STEP 2 — Department + Doctor ════════════════ */}
          {step === 2 && (
            <div>
              {/* Department dropdown */}
              <div className="form-group" style={{marginBottom:'16px'}}>
                <label className="form-label" style={{display:'flex', alignItems:'center', gap:'6px'}}>
                  <Building2 size={13}/> Department
                </label>
                <select
                  className="form-input"
                  style={{padding:'10px 14px', background:'#f8fafc'}}
                  value={selectedDept?.id || ''}
                  onChange={e => {
                    const d = departments.find(x => x.id === parseInt(e.target.value));
                    setSelectedDept(d || null);
                    setSelectedDoctor(null);
                    setShowAllDoctors(false);
                  }}
                >
                  <option value="" disabled>Select department…</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              {/* Doctor dropdown — shown once a department is selected */}
              {selectedDept && (
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label" style={{display:'flex', alignItems:'center', gap:'6px'}}>
                    <Stethoscope size={13}/>
                    {showAllDoctors
                      ? 'Doctor (All Departments)'
                      : `Doctor in ${selectedDept.name}`}
                  </label>

                  {loadingDoctors ? (
                    <p style={{fontSize:'12px', color:'#94a3b8', padding:'8px 0'}}>Loading doctors…</p>
                  ) : (
                    <select
                      className="form-input"
                      style={{padding:'10px 14px', background:'#f8fafc'}}
                      value={selectedDoctor?.id || ''}
                      onChange={e => {
                        const list = showAllDoctors ? allDoctors : deptDoctors;
                        const doc = list.find(x => x.id === parseInt(e.target.value));
                        setSelectedDoctor(doc || null);
                      }}
                    >
                      <option value="" disabled>
                        {doctorsToShow.length === 0
                          ? 'No doctors in this department'
                          : 'Select doctor…'}
                      </option>
                      {doctorsToShow.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          {doc.full_name || doc.email}
                          {doc.departments.length > 0
                            ? ` — ${doc.departments.map(d => d.name).join(', ')}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* See All Doctors toggle */}
                  {!showAllDoctors ? (
                    <button
                      onClick={loadAllDoctors}
                      style={{
                        marginTop:'10px', width:'100%', padding:'9px',
                        border:'1.5px dashed #cbd5e1', borderRadius:'10px',
                        background:'none', color:'#64748b',
                        fontSize:'12px', fontWeight:700, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                      }}
                    >
                      <Users size={14}/> See All Doctors (from other departments)
                    </button>
                  ) : (
                    <button
                      onClick={() => { setShowAllDoctors(false); setSelectedDoctor(null); }}
                      style={{
                        marginTop:'8px', background:'none', border:'none',
                        color:'var(--color-primary)', fontSize:'12px',
                        fontWeight:700, cursor:'pointer',
                      }}
                    >
                      ← Show only {selectedDept.name} doctors
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ STEP 3 — Date + Time Slot ════════════════ */}
          {step === 3 && (
            <div>
              {/* Date picker — next 14 days as cards */}
              <label className="form-label" style={{display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px'}}>
                <Calendar size={13}/> Select Date
              </label>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'20px'}}>
                {getNext14Days().map(d => {
                  const dateObj = new Date(d + 'T00:00:00');
                  const label = dateObj.toLocaleDateString('en-US', {weekday:'short', day:'numeric', month:'short'});
                  const isToday = d === new Date().toISOString().split('T')[0];
                  const chosen = d === selectedDate;
                  return (
                    <button key={d} onClick={() => setSelectedDate(d)}
                      style={{
                        padding:'8px 12px', borderRadius:'10px', cursor:'pointer',
                        border:`1.5px solid ${chosen ? 'var(--color-primary)' : '#e2e8f0'}`,
                        background: chosen ? 'var(--color-primary-light)' : '#f8fafc',
                        color: chosen ? 'var(--color-primary)' : '#334155',
                        fontSize:'12px', fontWeight: chosen ? 700 : 500,
                        transition:'all .15s',
                      }}>
                      {label}{isToday ? ' (Today)' : ''}
                    </button>
                  );
                })}
              </div>

              {/* Time slots */}
              {selectedDate && (
                <>
                  <label className="form-label" style={{display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px'}}>
                    <Clock size={13}/> Available Time Slots
                  </label>
                  {loadingSlots ? (
                    <p style={{fontSize:'12px', color:'#94a3b8'}}>Loading slots…</p>
                  ) : (
                    <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px'}}>
                      {slots.map(s => (
                        <button key={s.time}
                          disabled={!s.available}
                          onClick={() => s.available && setSelectedSlot(s.time)}
                          style={{
                            padding:'9px 0', borderRadius:'8px', fontSize:'12px', fontWeight:700,
                            cursor: s.available ? 'pointer' : 'not-allowed',
                            border:`1.5px solid ${
                              selectedSlot === s.time ? 'var(--color-primary)'
                              : !s.available ? '#f1f5f9' : '#e2e8f0'
                            }`,
                            background:
                              selectedSlot === s.time ? 'var(--color-primary-light)'
                              : !s.available ? '#f8fafc' : '#fff',
                            color:
                              selectedSlot === s.time ? 'var(--color-primary)'
                              : !s.available ? '#cbd5e1' : '#334155',
                            textDecoration: !s.available ? 'line-through' : 'none',
                            transition:'all .15s',
                          }}>
                          {s.time}
                        </button>
                      ))}
                    </div>
                  )}
                  <p style={{fontSize:'11px', color:'#94a3b8', marginTop:'10px'}}>
                    Strikethrough slots are already booked.
                  </p>
                </>
              )}
            </div>
          )}

          {/* ════════════════ STEP 4 — Notes + Reports ════════════════ */}
          {step === 4 && (
            <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>

              {/* Appointment summary */}
              <div style={{
                padding:'14px 16px', borderRadius:'12px',
                background:'#f8fafc', border:'1px solid #e2e8f0',
                display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px',
                fontSize:'13px',
              }}>
                <div><span style={{color:'#94a3b8', fontWeight:600}}>Patient: </span>{selectedPatient?.name}</div>
                <div><span style={{color:'#94a3b8', fontWeight:600}}>Doctor: </span>{selectedDoctor?.full_name || selectedDoctor?.email}</div>
                <div><span style={{color:'#94a3b8', fontWeight:600}}>Department: </span>{selectedDept?.name || '—'}</div>
                <div><span style={{color:'#94a3b8', fontWeight:600}}>Slot: </span>{selectedDate} @ {selectedSlot}</div>
              </div>

              {/* Notes */}
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Notes <span style={{color:'#94a3b8', fontWeight:400}}>(optional)</span></label>
                <textarea className="form-input"
                  style={{padding:'10px 14px', resize:'vertical', minHeight:'72px'}}
                  placeholder="Any notes for the doctor…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {/* Report upload */}
              <div>
                <label className="form-label" style={{display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px'}}>
                  <FileUp size={13}/> Attach Reports
                  <span style={{color:'#94a3b8', fontWeight:400, textTransform:'none', fontSize:'11px'}}>(optional · PDF, DOCX, JPG, PNG · max 5 MB each)</span>
                </label>

                <label style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  padding:'20px', border:'2px dashed #cbd5e1', borderRadius:'12px',
                  cursor:'pointer', background:'#f8fafc', transition:'all .2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--color-primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='#cbd5e1'}
                >
                  <FileUp size={24} color="#94a3b8"/>
                  <span style={{fontSize:'13px', color:'#64748b', marginTop:'8px', fontWeight:600}}>
                    Click to upload or drag files here
                  </span>
                  <span style={{fontSize:'11px', color:'#94a3b8', marginTop:'4px'}}>
                    NOTE: Please make PDF of all previous reports · Max 5 MB supported
                  </span>
                  <input type="file" multiple accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                    style={{display:'none'}} onChange={handleFileChange}/>
                </label>

                {fileError && (
                  <div style={{
                    marginTop:'8px', padding:'8px 12px', borderRadius:'8px',
                    background:'#fef2f2', border:'1px solid #fecaca',
                    color:'#991b1b', fontSize:'12px', display:'flex', gap:'6px', alignItems:'center',
                  }}>
                    <AlertTriangle size={14}/> {fileError}
                  </div>
                )}

                {files.length > 0 && (
                  <div style={{marginTop:'10px', display:'flex', flexDirection:'column', gap:'6px'}}>
                    {files.map(f => (
                      <div key={f.name} style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'8px 12px', background:'#f1f5f9', borderRadius:'8px',
                        fontSize:'12px', color:'#334155',
                      }}>
                        <span>📄 {f.name} <span style={{color:'#94a3b8'}}>({(f.size/1024).toFixed(0)} KB)</span></span>
                        <button onClick={() => removeFile(f.name)}
                          style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:'2px'}}>
                          <X size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>{/* end body */}

        {/* ── Modal Footer — navigation buttons ────────────────── */}
        <div style={{
          padding:'16px 24px', borderTop:'1px solid #f1f5f9',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          position:'sticky', bottom:0, background:'#fff',
          borderRadius:'0 0 20px 20px',
        }}>
          <button
            onClick={() => { setErrorMsg(''); step > 1 ? setStep(s => s-1) : onClose(); }}
            style={btnSecondary}
          >
            <ChevronLeft size={15}/> {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 4 ? (
            <button
            onClick={() => {
              setErrorMsg('');
              if (step === 1 && showAddPatient) return setErrorMsg('Please finish registering the patient first.');
              if (step === 1 && !selectedPatient) return setErrorMsg('Please select a patient first.');
              if (step === 2 && !selectedDoctor)  return setErrorMsg('Please select a doctor.');
              if (step === 3 && !selectedDate)    return setErrorMsg('Please select a date.');
              if (step === 3 && !selectedSlot)    return setErrorMsg('Please select a time slot.');
              setStep(s => s+1);
            }}
            style={btnPrimary}
          >
              Next <ChevronRight size={15}/>
            </button>
          ) : (
            <button
              onClick={handleBook}
              disabled={booking}
              style={{...btnPrimary, opacity: booking ? 0.7 : 1, cursor: booking ? 'not-allowed':'pointer'}}
            >
              {booking ? 'Booking…' : <><CheckCircle size={15}/> Confirm Appointment</>}
            </button>
          )}
        </div>

      </div>{/* end modal panel */}
    </div>   /* end backdrop */
  );
}
