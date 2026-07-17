/**
 * features/nurse/CarePlanModal.jsx
 * ----------------------------------
 * Full-screen modal showing a patient's care plan for the nurse.
 * Tabs: Vitals | Orders | Notes | Procedures | Discharge
 *
 * Props:
 *   patient - { appointment_id, visit_id, patient_name, patient_allergies,
 *               blood_group, doctor_name, appt_status, visit_status }
 *   token   - JWT bearer token
 *   onClose - dismiss handler
 *   onAction - called after any write (refreshes the queue)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Activity, ClipboardList, FileText,
  Stethoscope, LogOut, RefreshCw,
  AlertTriangle, Droplets,
} from 'lucide-react';
import {
  fetchCarePlan, recordVitals, logProcedure,
  submitDischargeChecklist,
} from '../../services/nurseService';
import Alert from '../../components/ui/Alert';
import NurseVitalsForm from './NurseVitalsForm';
import NurseProcedureForm from './NurseProcedureForm';
import NurseDischargeForm from './NurseDischargeForm';

const TABS = [
  { key: 'vitals',     label: 'Record Vitals',    Icon: Activity      },
  { key: 'orders',     label: 'Orders & Plan',    Icon: ClipboardList },
  { key: 'notes',      label: 'Doctor Notes',     Icon: FileText      },
  { key: 'procedure',  label: 'Log Procedure',    Icon: Stethoscope   },
  { key: 'discharge',  label: 'Discharge',        Icon: LogOut        },
];

const STATUS_META = {
  IN_PROGRESS: { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
  COMPLETED:   { bg: '#d1fae5', color: '#065f46', label: 'Completed'   },
};

export default function CarePlanModal({ patient, token, onClose, onAction }) {
  const [tab, setTab]           = useState('vitals');
  const [plan, setPlan]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load care plan once on open
  const load = useCallback(async () => {
    if (!patient.visit_id) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await fetchCarePlan(token, patient.visit_id);
      setPlan(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load care plan.');
    } finally {
      setLoading(false);
    }
  }, [token, patient.visit_id]);

  useEffect(() => { load(); }, [load]);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSaved = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
    load();          // refresh care plan data
    onAction?.();    // refresh queue
  };

  const visitStatus = plan?.visit_status || patient.visit_status || '';
  const sm = STATUS_META[visitStatus] || { bg: '#f1f5f9', color: '#475569', label: visitStatus };
  const isActive = visitStatus === 'IN_PROGRESS';
  const isCompleted = visitStatus === 'COMPLETED';

  const sharedProps = {
    token,
    visitId: patient.visit_id,
    onSaved: handleSaved,
    isActive,
    isCompleted,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '20px', width: '100%',
          maxWidth: '900px', height: '88vh', display: 'flex',
          flexDirection: 'column', boxShadow: '0 32px 64px rgba(15,23,42,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
          background: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(99,102,241,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Stethoscope size={20} color="#6366f1" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {patient.patient_name}
                </h2>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                  borderRadius: '20px', background: sm.bg, color: sm.color,
                }}>
                  {sm.label}
                </span>
                {patient.patient_allergies && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                    borderRadius: '20px', background: '#fef3c7', color: '#92400e',
                    display: 'flex', alignItems: 'center', gap: '3px',
                  }}>
                    <AlertTriangle size={10} /> Allergies
                  </span>
                )}
                {patient.blood_group && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                    borderRadius: '20px', background: '#fee2e2', color: '#991b1b',
                    display: 'flex', alignItems: 'center', gap: '3px',
                  }}>
                    <Droplets size={10} /> {patient.blood_group}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Dr. {patient.doctor_name || '—'} · {patient.appointment_time} · Appt #{patient.appointment_id}
              </p>
              {patient.patient_allergies && (
                <p style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>
                  ⚠ Known allergies: {patient.patient_allergies}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={load} title="Refresh"
              style={{ width: 32, height: 32, borderRadius: '8px',
                background: '#f8fafc', border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#64748b' }}>
              <RefreshCw size={14} />
            </button>
            <button onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: '8px',
                background: '#f8fafc', border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#64748b' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Global alerts */}
        {(errorMsg || successMsg) && (
          <div style={{ padding: '10px 24px 0', flexShrink: 0 }}>
            <Alert type="error"   message={errorMsg}   />
            <Alert type="success" message={successMsg} />
          </div>
        )}

        {/* ── Tab bar ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #f1f5f9',
          padding: '0 16px', flexShrink: 0, background: '#fff',
          overflowX: 'auto',
        }}>
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            const disabled = key === 'discharge' && !isCompleted;
            return (
              <button key={key}
                onClick={() => !disabled && setTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '11px 14px',
                  borderBottom: `2px solid ${active ? '#6366f1' : 'transparent'}`,
                  background: 'none', border: 'none',
                  color: active ? '#6366f1' : disabled ? '#cbd5e1' : '#64748b',
                  fontSize: '12px', fontWeight: active ? 700 : 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                  opacity: disabled ? 0.5 : 1,
                }}>
                <Icon size={13} /> {label}
                {key === 'discharge' && !isCompleted && (
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>(after doctor completes)</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ─────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
              Loading care plan…
            </p>
          ) : !patient.visit_id ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <Stethoscope size={36} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p style={{ fontSize: '13px' }}>
                No active consultation yet. Patient is checked in but doctor hasn't started.
              </p>
            </div>
          ) : (
            <>
              {tab === 'vitals'    && <NurseVitalsForm    {...sharedProps} vitalsHistory={plan?.vitals_history || []} />}
              {tab === 'orders'    && <OrdersView          plan={plan} />}
              {tab === 'notes'     && <NotesView           plan={plan} />}
              {tab === 'procedure' && <NurseProcedureForm  {...sharedProps} />}
              {tab === 'discharge' && <NurseDischargeForm  {...sharedProps} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Read-only orders view ───────────────────────────────────────────────── */
function OrdersView({ plan }) {
  if (!plan) return null;
  const sectionStyle = { marginBottom: '20px' };
  const headStyle = { fontSize: '11px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' };
  const itemStyle = {
    padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: '10px', fontSize: '13px', color: '#334155', marginBottom: '6px',
  };
  return (
    <div>
      {plan.diagnoses.length > 0 && (
        <div style={sectionStyle}>
          <p style={headStyle}>Diagnoses</p>
          {plan.diagnoses.map(d => (
            <div key={d.id} style={itemStyle}>
              <strong>{d.description}</strong>
              {d.icd_code && <span style={{ color: '#64748b', marginLeft: '8px' }}>[{d.icd_code}]</span>}
              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#92400e',
                background: '#fef3c7', padding: '1px 6px', borderRadius: '10px' }}>
                {d.severity}
              </span>
            </div>
          ))}
        </div>
      )}
      {plan.prescriptions.length > 0 && (
        <div style={sectionStyle}>
          <p style={headStyle}>Prescriptions</p>
          {plan.prescriptions.map(p => (
            <div key={p.id} style={itemStyle}>
              <strong>{p.medication}</strong> — {p.dosage} {p.frequency} ({p.route})
              <span style={{ marginLeft: '8px', fontSize: '11px',
                color: p.status === 'AVAILABLE_TO_PHARMACY' ? '#065f46' : '#475569',
                background: p.status === 'AVAILABLE_TO_PHARMACY' ? '#d1fae5' : '#f1f5f9',
                padding: '1px 6px', borderRadius: '10px' }}>
                {p.status === 'AVAILABLE_TO_PHARMACY' ? 'Sent to Pharmacy' : 'Draft'}
              </span>
            </div>
          ))}
        </div>
      )}
      {plan.lab_orders.length > 0 && (
        <div style={sectionStyle}>
          <p style={headStyle}>Lab Orders</p>
          {plan.lab_orders.map(lo => (
            <div key={lo.id} style={itemStyle}>
              {lo.test} {lo.notes && <span style={{ color: '#64748b' }}>— {lo.notes}</span>}
            </div>
          ))}
        </div>
      )}
      {plan.radiology_orders.length > 0 && (
        <div style={sectionStyle}>
          <p style={headStyle}>Radiology Orders</p>
          {plan.radiology_orders.map(ro => (
            <div key={ro.id} style={itemStyle}>
              <strong>{ro.type}</strong> — {ro.region}: {ro.indication}
            </div>
          ))}
        </div>
      )}
      {!plan.diagnoses.length && !plan.prescriptions.length &&
       !plan.lab_orders.length && !plan.radiology_orders.length && (
        <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
          No orders or diagnoses yet.
        </p>
      )}
    </div>
  );
}

/* ── Read-only notes view ────────────────────────────────────────────────── */
function NotesView({ plan }) {
  if (!plan?.notes?.length)
    return <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>No notes yet.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {plan.notes.map(n => (
        <div key={n.id} style={{
          padding: '12px 14px', background: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: '10px',
        }}>
          <p style={{ fontSize: '13px', color: '#0f172a', whiteSpace: 'pre-wrap' }}>{n.content}</p>
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
            {new Date(n.written_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
