/**
 * features/receptionist/PatientDetailModal.jsx
 * ----------------------------------------------
 * Full-screen overlay modal showing all patient details,
 * demographic editing, visit timelines, and uploaded documents.
 *
 * Props:
 *   patient   - Patient object to display
 *   token     - JWT bearer token
 *   onClose   - Called when the modal is dismissed
 *   onUpdated - Called with the updated patient object after a successful save
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Edit2, Save, XCircle, Download, FileDown,
  User, Phone, Mail, MapPin, Droplets, Activity,
  AlertTriangle, FileText, Calendar, Hash, Stethoscope,
} from 'lucide-react';
import { updatePatient } from '../../services/patientService';
import DocumentViewerModal from '../documents/DocumentViewerModal';
import { getPatientHistory, getVisitChart } from '../../services/visitService';
import { listPatientDocuments, downloadDocument, getDocumentContent } from '../../services/documentService';
import { listAppointments, downloadAppointmentReport } from '../../services/appointmentService';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
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
  const { userProfile } = useAuth();
  
  // Tabs: demographics | visits | documents
  const [activeTab, setActiveTab] = useState('demographics');

  // Demographic edit states
  const [mode, setMode]         = useState('view');   // 'view' | 'edit'
  const [form, setForm]         = useState({});
  const [saving, setSaving]     = useState(false);

  // Lists & Loading states
  const [visits, setVisits]             = useState([]);
  const [charts, setCharts]             = useState({});
  const [expandedVisitId, setExpandedVisitId] = useState(null);
  const [loadingVisits, setLoadingVisits] = useState(false);

  const [documents, setDocuments]       = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingDocs, setLoadingDocs]   = useState(false);

  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // viewingDocId — opens DocumentViewerModal (ClinicalRenderer inside)
  const [viewingDocId, setViewingDocId] = useState(null);
  const [loadingContentId, setLoadingContentId] = useState(null);

  // "Parsed Data" button — just open the viewer modal with the doc id
  const handleViewParsedData = (docId) => {
    setViewingDocId(docId);
  };

  const isMedicalStaff = [
    ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE,
  ].includes(userProfile?.role_id);
  const canEdit = userProfile?.is_superuser || [
    ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST,
  ].includes(userProfile?.role_id);

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

  // Load visits
  const loadVisits = useCallback(async () => {
    setLoadingVisits(true);
    setErrorMsg('');
    try {
      const data = await getPatientHistory(token, patient.id);
      setVisits(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load visit history.');
    } finally {
      setLoadingVisits(false);
    }
  }, [token, patient.id]);

  // Load documents & appointments (with reports)
  const loadDocsAndAppts = useCallback(async () => {
    setLoadingDocs(true);
    setErrorMsg('');
    try {
      const [docsData, apptsData] = await Promise.all([
        listPatientDocuments(token, patient.id),
        listAppointments(token, { patient_id: patient.id })
      ]);
      setDocuments(docsData);
      setAppointments(apptsData);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load files.');
    } finally {
      setLoadingDocs(false);
    }
  }, [token, patient.id]);

  // Handle Tab changes
  useEffect(() => {
    if (activeTab === 'visits') {
      loadVisits();
    } else if (activeTab === 'documents') {
      loadDocsAndAppts();
    }
  }, [activeTab, loadVisits, loadDocsAndAppts]);

  // Handle collapsible visit click
  const handleToggleVisit = async (visitId) => {
    if (expandedVisitId === visitId) {
      setExpandedVisitId(null);
      return;
    }
    setExpandedVisitId(visitId);
    if (!charts[visitId]) {
      try {
        const data = await getVisitChart(token, visitId);
        setCharts(prev => ({ ...prev, [visitId]: data }));
      } catch (err) {
        console.error('Failed to load visit chart details:', err);
      }
    }
  };

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
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '680px',
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
          zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeTab === 'demographics' && canEdit && (
              mode === 'view' ? (
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
              )
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

        {/* ── Tab Bar (Roles: Super/Hosp Admin, Doctor, Nurse) ─────────── */}
        {isMedicalStaff && (
          <div style={{
            display: 'flex', gap: '8px', padding: '0 24px',
            borderBottom: '1px solid #f1f5f9', background: '#fff',
            position: 'sticky', top: '84px', zIndex: 1
          }}>
            {['demographics', 'visits', 'documents'].map(t => {
              const label = t === 'demographics' ? 'Profile Details' : t === 'visits' ? 'Clinical Visits' : 'Reports & Files';
              return (
                <button
                  key={t}
                  onClick={() => { setActiveTab(t); setMode('view'); }}
                  style={{
                    padding: '12px 4px', background: 'none', border: 'none',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    color: activeTab === t ? 'var(--color-primary)' : '#64748b',
                    borderBottom: activeTab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
                    transition: 'all 0.15s', marginRight: '16px'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '24px' }}>
          <Alert type="error"   message={errorMsg}   />
          <Alert type="success" message={successMsg} />

          {activeTab === 'demographics' && (
            mode === 'view' ? (
              /* ── VIEW MODE (Demographics) ───────────────────────────────── */
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
              /* ── EDIT MODE (Demographics) ───────────────────────────────── */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="input-wrapper">
                    <User className="input-icon" size={14} style={{ left: '12px' }} />
                    <input type="text" className="form-input"
                      style={{ padding: '9px 9px 9px 34px' }}
                      value={form.name} onChange={set('name')} required />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Age <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="number" className="form-input"
                    style={{ padding: '9px 14px' }}
                    min={1} max={150}
                    value={form.age} onChange={set('age')} required />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Phone <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="input-wrapper">
                    <Phone className="input-icon" size={14} style={{ left: '12px' }} />
                    <input type="tel" className="form-input"
                      style={{ padding: '9px 9px 9px 34px' }}
                      value={form.phone} onChange={set('phone')} required />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Gender <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="form-input"
                    style={{ padding: '9px 14px', background: '#f8fafc' }}
                    value={form.gender} onChange={set('gender')} required>
                    <option value="" disabled>Select gender</option>
                    {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={14} style={{ left: '12px' }} />
                    <input type="email" className="form-input"
                      style={{ padding: '9px 9px 9px 34px' }}
                      value={form.email} onChange={set('email')} />
                  </div>
                </div>

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

                <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="form-label">Address <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <div className="input-wrapper">
                    <MapPin className="input-icon" size={14} style={{ left: '12px' }} />
                    <input type="text" className="form-input"
                      style={{ padding: '9px 9px 9px 34px' }}
                      value={form.address} onChange={set('address')} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="form-label">Allergies <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <div className="input-wrapper">
                    <AlertTriangle className="input-icon" size={14} style={{ left: '12px' }} />
                    <input type="text" className="form-input"
                      style={{ padding: '9px 9px 9px 34px' }}
                      value={form.allergies} onChange={set('allergies')} />
                  </div>
                </div>

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
            )
          )}

          {activeTab === 'visits' && (
            /* ── CLINICAL VISITS TIMELINE ─────────────────────────────────── */
            <div>
              {loadingVisits ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '24px 0', fontSize: '13px' }}>
                  Loading clinical history timeline…
                </p>
              ) : visits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                  <Activity size={32} style={{ marginBottom: '10px', opacity: 0.3 }} />
                  <p style={{ fontSize: '13px' }}>No recorded visits for this patient.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {visits.map(v => {
                    const isExpanded = expandedVisitId === v.id;
                    const chart = charts[v.id];
                    return (
                      <div key={v.id} style={{
                        border: '1px solid var(--color-border)', borderRadius: '12px',
                        background: '#ffffff', overflow: 'hidden', transition: 'all 0.2s',
                        boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                      }}>
                        {/* Visit Header card */}
                        <div
                          onClick={() => handleToggleVisit(v.id)}
                          style={{
                            padding: '14px 18px', display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#ffffff',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                                Visit: {new Date(v.started_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              <span style={{
                                fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px',
                                background: v.status === 'COMPLETED' ? '#d1fae5' : '#dbeafe',
                                color: v.status === 'COMPLETED' ? '#065f46' : '#1e40af'
                              }}>
                                {v.status}
                              </span>
                            </div>
                            {v.primary_diagnosis && (
                              <p style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '4px' }}>
                                Diagnosis: {v.primary_diagnosis}
                              </p>
                            )}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700 }}>
                            {isExpanded ? 'Hide Details ▲' : 'View Chart ▼'}
                          </span>
                        </div>

                        {/* Collapsible content details */}
                        {isExpanded && (
                          <div style={{ padding: '18px', borderTop: '1px solid var(--color-border)', background: '#fafbfc' }}>
                            {!chart ? (
                              <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '10px 0' }}>
                                Loading clinical details…
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Vitals section */}
                                {chart.vitals && chart.vitals.length > 0 ? (
                                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Activity size={12} /> Recorded Vitals
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                                      {chart.vitals.map(vit => (
                                        <div key={vit.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '12px' }}>
                                          <div>
                                            <span style={{ color: '#94a3b8', fontSize: '10px' }}>Heart Rate:</span>
                                            <p style={{ fontWeight: 700, color: '#0f172a' }}>{vit.heart_rate || '—'} bpm</p>
                                          </div>
                                          <div>
                                            <span style={{ color: '#94a3b8', fontSize: '10px' }}>BP:</span>
                                            <p style={{ fontWeight: 700, color: '#0f172a' }}>{vit.systolic && vit.diastolic ? `${vit.systolic}/${vit.diastolic}` : '—'}</p>
                                          </div>
                                          <div style={{ marginTop: '4px' }}>
                                            <span style={{ color: '#94a3b8', fontSize: '10px' }}>Temp:</span>
                                            <p style={{ fontWeight: 700, color: '#0f172a' }}>{vit.temperature || '—'} °C</p>
                                          </div>
                                          <div style={{ marginTop: '4px' }}>
                                            <span style={{ color: '#94a3b8', fontSize: '10px' }}>SpO2:</span>
                                            <p style={{ fontWeight: 700, color: '#0f172a' }}>{vit.oxygen_saturation || '—'} %</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p style={{ fontSize: '11px', color: '#94a3b8', italic: true }}>No vitals recorded in this visit.</p>
                                )}

                                {/* Notes section */}
                                {chart.notes && chart.notes.length > 0 && (
                                  <div>
                                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Clinical Progress Notes</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {chart.notes.map(n => (
                                        <div key={n.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                                          <p style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>{n.content}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Diagnoses section */}
                                {chart.diagnoses && chart.diagnoses.length > 0 && (
                                  <div>
                                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Diagnoses</h4>
                                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                                      <ul style={{ paddingLeft: '14px', fontSize: '12px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {chart.diagnoses.map(d => (
                                          <li key={d.id}>
                                            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{d.code}</span> — {d.description}
                                            {d.is_primary && (
                                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '1px 5px', borderRadius: '10px', marginLeft: '6px' }}>Primary</span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}

                                {/* Prescriptions section */}
                                {chart.prescriptions && chart.prescriptions.length > 0 && (
                                  <div>
                                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Prescribed Medications</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {chart.prescriptions.map(p => (
                                        <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div>
                                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{p.medicine_name}</p>
                                            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Dosage: {p.dosage} • Freq: {p.frequency}</p>
                                          </div>
                                          <span style={{ fontSize: '11px', color: '#065f46', background: '#d1fae5', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                            {p.duration_days} days
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            /* ── REPORTS & FILES SECTION ──────────────────────────────────── */
            <div>
              {loadingDocs ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '24px 0', fontSize: '13px' }}>
                  Loading patient documents and reports…
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Receptionist Uploads (from appointments) */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Front Desk/Receptionist Uploads (Appointment Creation)
                    </p>
                    {appointments.filter(a => a.reports && a.reports.length > 0).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8' }}>
                        <p style={{ fontSize: '12px' }}>No reports uploaded at appointment booking.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {appointments.flatMap(a => a.reports.map(r => ({ ...r, appointment_id: a.id, date: a.appointment_date }))).map(r => {
                          const matchingDoc = documents.find(d => d.original_filename === r.original_filename && d.file_size === r.file_size);
                          return (
                            <div key={r.id} style={{
                              background: '#ffffff', padding: '10px 14px', borderRadius: '10px',
                              border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{r.original_filename}</p>
                                <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                  Size: {(r.file_size / 1024).toFixed(1)} KB • Appointment Date: {r.date}
                                </p>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => downloadAppointmentReport(token, r.appointment_id, r.id, r.original_filename)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    background: 'var(--color-primary-light)', border: 'none', color: 'var(--color-primary)',
                                    padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                                  }}
                                >
                                  <Download size={12} /> Get File
                                </button>
                                {matchingDoc && (
                                  <button
                                    onClick={() => handleViewParsedData(matchingDoc.id)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '4px',
                                      background: '#f1f5f9', border: 'none', color: '#475569',
                                      padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                                    }}
                                  >
                                    <FileText size={12} /> {loadingContentId === matchingDoc.id ? 'Loading...' : 'Parsed Data'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Visit level uploads (medical reports / files) */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Clinical Documents & Lab/Radiology Files (Visit Context)
                    </p>
                    {documents.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8' }}>
                        <p style={{ fontSize: '12px' }}>No medical documents or lab reports found.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {documents.map(doc => (
                          <div key={doc.id} style={{
                            background: '#ffffff', padding: '10px 14px', borderRadius: '10px',
                            border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div>
                              <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{doc.original_filename}</p>
                              <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                Type: {doc.document_type.toUpperCase()} • Size: {(doc.file_size / 1024).toFixed(1)} KB • Status: {doc.status}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => downloadDocument(token, doc.id, doc.original_filename)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  background: 'var(--color-primary-light)', border: 'none', color: 'var(--color-primary)',
                                  padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                <FileDown size={12} /> Download
                              </button>
                              <button
                                onClick={() => handleViewParsedData(doc.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  background: '#f1f5f9', border: 'none', color: '#475569',
                                  padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                <FileText size={12} /> {loadingContentId === doc.id ? 'Loading...' : 'Parsed Data'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── DOCUMENT VIEWER MODAL — renders ClinicalRenderer ───────────── */}
      {viewingDocId && (
        <DocumentViewerModal
          documentId={viewingDocId}
          token={token}
          onClose={() => setViewingDocId(null)}
        />
      )}
    </div>
  );
}
