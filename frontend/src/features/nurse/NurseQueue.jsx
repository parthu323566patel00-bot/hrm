/**
 * features/nurse/NurseQueue.jsx
 * --------------------------------
 * Ward queue — shows today's checked-in and in-progress patients.
 * Clicking "Open Care Plan" opens CarePlanModal.
 *
 * Props:
 *   token      - JWT bearer token
 *   refreshKey - increment to reload
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Clock, RefreshCw, ClipboardList,
  Activity, AlertTriangle, Droplets, CheckCircle2,
} from 'lucide-react';
import { fetchNurseQueue } from '../../services/nurseService';
import CarePlanModal from './CarePlanModal';
import PreVitalsModal from './PreVitalsModal';
import Alert from '../../components/ui/Alert';

const STATUS_STYLE = {
  checked_in:  { bg: '#fef3c7', color: '#92400e', label: 'Checked In' },
  in_progress: { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
};

export default function NurseQueue({ token, refreshKey }) {
  const [patients, setPatients]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');
  const [selected, setSelected]   = useState(null);      // patient for care plan modal
  const [preVitals, setPreVitals] = useState(null);      // patient for pre-vitals modal
  const [queueKey, setQueueKey]   = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setErrorMsg('');
    try {
      const data = await fetchNurseQueue(token);
      setPatients(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load ward queue.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load, refreshKey, queueKey]);

  const handleAction = () => setQueueKey(k => k + 1);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const checkedIn  = patients.filter(p => p.appt_status === 'checked_in').length;
  const inProgress = patients.filter(p => p.appt_status === 'in_progress').length;

  return (
    <>
      <div className="card-panel">
        {/* Header */}
        <div className="panel-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: '#6366f1' }} /> Ward Patient Queue
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              <strong style={{ color: '#92400e' }}>{checkedIn}</strong> waiting ·{' '}
              <strong style={{ color: '#1e40af' }}>{inProgress}</strong> in consult
            </span>
            <button onClick={load} title="Refresh"
              style={{
                background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px',
                padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex',
              }}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px', marginTop: '-8px' }}>
          {todayLabel}
        </p>

        <Alert type="error" message={errorMsg} />

        {loading ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
            Loading…
          </p>
        ) : patients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <Users size={36} style={{ marginBottom: '10px', opacity: 0.3 }} />
            <p style={{ fontSize: '13px' }}>No patients checked in today.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {patients.map(p => {
              const ss = STATUS_STYLE[p.appt_status] || STATUS_STYLE.checked_in;
              return (
                <div key={p.appointment_id} style={{
                  display: 'grid', gridTemplateColumns: '52px 1fr auto',
                  alignItems: 'center', gap: '12px',
                  padding: '14px 16px', borderRadius: '12px',
                  border: `1px solid ${p.appt_status === 'checked_in' ? '#fcd34d' : '#93c5fd'}`,
                  background: p.appt_status === 'checked_in' ? '#fffbeb' : '#eff6ff',
                  transition: 'all 0.15s',
                }}>
                  {/* Time */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#6366f1' }}>
                      {p.appointment_time}
                    </div>
                    <Clock size={11} style={{ color: '#94a3b8', marginTop: '2px' }} />
                  </div>

                  {/* Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        {p.patient_name}
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                        borderRadius: '20px', background: ss.bg, color: ss.color,
                      }}>
                        {ss.label}
                      </span>
                      {p.patient_allergies && (
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                          borderRadius: '20px', background: '#fef3c7', color: '#92400e',
                          display: 'flex', alignItems: 'center', gap: '3px',
                        }}>
                          <AlertTriangle size={10} /> Allergies
                        </span>
                      )}
                      {p.blood_group && (
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                          borderRadius: '20px', background: '#fee2e2', color: '#991b1b',
                          display: 'flex', alignItems: 'center', gap: '3px',
                        }}>
                          <Droplets size={10} /> {p.blood_group}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Age {p.patient_age} · {p.patient_gender}</span>
                      {p.doctor_name && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>Dr. {p.doctor_name}</span>
                      )}
                      {p.department_name && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{p.department_name}</span>
                      )}
                    </div>

                    {/* Latest vitals summary */}
                    {p.latest_vitals && (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {p.latest_vitals.systolic_bp && (
                          <span style={{ fontSize: '11px', color: '#475569' }}>
                            <Activity size={10} /> BP: {p.latest_vitals.systolic_bp}/{p.latest_vitals.diastolic_bp}
                          </span>
                        )}
                        {p.latest_vitals.heart_rate && (
                          <span style={{ fontSize: '11px', color: '#475569' }}>HR: {p.latest_vitals.heart_rate}</span>
                        )}
                        {p.latest_vitals.temperature && (
                          <span style={{ fontSize: '11px', color: '#475569' }}>Temp: {p.latest_vitals.temperature}°C</span>
                        )}
                        {p.latest_vitals.spo2 && (
                          <span style={{ fontSize: '11px', color: '#475569' }}>SpO₂: {p.latest_vitals.spo2}%</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Pre-vitals button — always available for checked-in patients */}
                    {p.appt_status === 'checked_in' && !p.visit_id && (
                      <button
                        onClick={() => setPreVitals(p)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '7px 12px', borderRadius: '8px',
                          background: 'rgba(99,102,241,0.1)',
                          border: '1.5px solid rgba(99,102,241,0.25)',
                          color: '#6366f1', fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>
                        <Activity size={13} /> Record Vitals
                      </button>
                    )}

                    {/* Open Care Plan — only when visit exists */}
                    {p.visit_id ? (
                      <button
                        onClick={() => setSelected(p)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '7px 14px', borderRadius: '8px',
                          background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                          border: 'none', color: '#fff', fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>
                        <ClipboardList size={13} /> Open Care Plan
                      </button>
                    ) : p.appt_status === 'checked_in' ? (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                        Awaiting doctor
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Care Plan Modal */}
      {selected && (
        <CarePlanModal
          patient={selected}
          token={token}
          onClose={() => setSelected(null)}
          onAction={handleAction}
        />
      )}

      {/* Pre-Vitals Modal — for checked-in patients before consultation starts */}
      {preVitals && (
        <PreVitalsModal
          patient={preVitals}
          token={token}
          onClose={() => setPreVitals(null)}
          onSaved={(msg) => {
            setPreVitals(null);
            handleAction();
          }}
        />
      )}
    </>
  );
}
