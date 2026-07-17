/**
 * features/doctor/PatientChart.jsx
 * -----------------------------------
 * Full-screen patient chart modal opened from DoctorQueue.
 * Hosts the Start Consultation button, ConsultationView tabs,
 * Patient History sidebar, Sign + Complete controls.
 *
 * Props:
 *   appointment - appointment object from DoctorQueue
 *   token       - JWT bearer token
 *   onClose     - called when modal is dismissed
 *   onVisitUpdate - called when visit status changes (to refresh queue)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, User, Stethoscope, Play, CheckCircle2,
  PenLine, Clock, AlertTriangle, History,
} from 'lucide-react';
import {
  canStartConsultation, startConsultation,
  getVisitChart, signConsultation, completeConsultation,
  getPatientHistory,
} from '../../services/visitService';
import ConsultationView from './ConsultationView';
import PatientHistory from './PatientHistory';
import Alert from '../../components/ui/Alert';

const STATUS_META = {
  scheduled:   { color: '#1d4ed8', bg: '#eff6ff', label: 'Scheduled' },
  checked_in:  { color: '#92400e', bg: '#fef3c7', label: 'Checked In' },
  in_progress: { color: '#1e40af', bg: '#dbeafe', label: 'In Progress' },
  completed:   { color: '#065f46', bg: '#d1fae5', label: 'Completed' },
  cancelled:   { color: '#991b1b', bg: '#fee2e2', label: 'Cancelled' },
};

export default function PatientChart({ appointment, token, onClose, onVisitUpdate }) {
  const [canStart, setCanStart]     = useState(null);   // null = loading
  const [visitChart, setVisitChart] = useState(null);
  const [history, setHistory]       = useState([]);
  const [activeTab, setActiveTab]   = useState('vitals');
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const apptStatus = visitChart
    ? (visitChart.status === 'IN_PROGRESS' ? 'in_progress' : 'completed')
    : appointment.status;

  const sm = STATUS_META[apptStatus] || STATUS_META.scheduled;

  // Check start eligibility + load chart if visit already active
  const refresh = useCallback(async () => {
    try {
      const info = await canStartConsultation(token, appointment.id);
      setCanStart(info);
      if (info.visit_id) {
        const chart = await getVisitChart(token, info.visit_id);
        setVisitChart(chart);
      } else {
        setVisitChart(null);
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  }, [token, appointment.id]);

  useEffect(() => {
    refresh();
    getPatientHistory(token, appointment.patient_id).then(setHistory).catch(() => {});
  }, [refresh, token, appointment.patient_id]);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleStart = async () => {
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const res = await startConsultation(token, appointment.id);
      const chart = await getVisitChart(token, res.visit_id);
      setVisitChart(chart);
      setCanStart({ can_start: false, visit_id: res.visit_id });
      setSuccessMsg('Consultation started. Patient chart is now active.');
      onVisitUpdate?.();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!visitChart) return;
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await signConsultation(token, visitChart.id);
      const chart = await getVisitChart(token, visitChart.id);
      setVisitChart(chart);
      setSuccessMsg('Medical record signed successfully.');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!visitChart) return;
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const chart = await completeConsultation(token, visitChart.id);
      setVisitChart(chart);
      setSuccessMsg('Consultation completed. Prescriptions, lab and radiology orders distributed.');
      onVisitUpdate?.();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isActive   = visitChart?.status === 'IN_PROGRESS';
  const isDone     = visitChart?.status === 'COMPLETED';
  const isSigned   = !!visitChart?.medical_record?.signature_hash;
  const canSign    = isActive && !isSigned;
  const canComplete = isActive && isSigned;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '20px', width: '100%',
          maxWidth: '1100px', height: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 64px rgba(15,23,42,0.25)',
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
              background: 'var(--color-primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={20} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  {appointment.patient_name}
                </h2>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                  borderRadius: '20px', background: sm.bg, color: sm.color,
                }}>
                  {sm.label}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                {appointment.time_slot} · {appointment.department_name || 'General'} · ID #{appointment.id}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowHistory(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 12px', borderRadius: '8px',
                background: showHistory ? 'var(--color-primary-light)' : '#f1f5f9',
                border: '1px solid ' + (showHistory ? 'rgba(0,172,193,0.3)' : '#e2e8f0'),
                color: showHistory ? 'var(--color-primary)' : '#475569',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <History size={14} /> History ({history.length})
            </button>
            <button onClick={onClose} style={{
              width: 34, height: 34, borderRadius: '8px',
              background: '#f8fafc', border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748b',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Alerts ─────────────────────────────────────────── */}
        {(errorMsg || successMsg) && (
          <div style={{ padding: '0 24px', paddingTop: '12px', flexShrink: 0 }}>
            <Alert type="error"   message={errorMsg}   />
            <Alert type="success" message={successMsg} />
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* History sidebar */}
          {showHistory && (
            <div style={{
              width: '260px', flexShrink: 0,
              borderRight: '1px solid #f1f5f9',
              overflowY: 'auto', padding: '16px',
            }}>
              <PatientHistory history={history} token={token} patientId={appointment.patient_id} />
            </div>
          )}

          {/* Main chart area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Start Consultation button area */}
            {!visitChart && (
              <div style={{
                padding: '24px', borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {canStart === null ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px' }}>Checking status…</p>
                ) : canStart.can_start ? (
                  <button
                    onClick={handleStart}
                    disabled={loading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '12px 28px', borderRadius: '12px',
                      background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                      border: 'none', color: '#fff',
                      fontSize: '15px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.7 : 1,
                      boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
                    }}
                  >
                    <Play size={18} /> {loading ? 'Starting…' : 'Start Consultation'}
                  </button>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 20px', borderRadius: '12px',
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    color: '#64748b', fontSize: '13px', fontWeight: 600,
                  }}>
                    {canStart.hide
                      ? <><CheckCircle2 size={16} color="#10b981" /> {canStart.reason}</>
                      : <><Clock size={16} /> {canStart.reason}</>
                    }
                  </div>
                )}
              </div>
            )}

            {/* Active consultation workspace */}
            {visitChart && (
              <ConsultationView
                visit={visitChart}
                token={token}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onDataSaved={async () => {
                  const chart = await getVisitChart(token, visitChart.id);
                  setVisitChart(chart);
                }}
              />
            )}

            {/* Sign + Complete footer */}
            {visitChart && (
              <div style={{
                padding: '14px 24px', borderTop: '1px solid #f1f5f9',
                background: '#fff', display: 'flex',
                alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
                flexShrink: 0,
              }}>
                {isDone && (
                  <span style={{ fontSize: '13px', color: '#065f46', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Consultation Completed
                  </span>
                )}
                {canSign && (
                  <button onClick={handleSign} disabled={loading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '9px 18px', borderRadius: '10px',
                      background: '#fef3c7', border: '1px solid #fcd34d',
                      color: '#92400e', fontSize: '13px', fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                    }}>
                    <PenLine size={15} /> Sign Consultation
                  </button>
                )}
                {isSigned && isActive && !canComplete && (
                  <span style={{ fontSize: '12px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={14} /> Signed
                  </span>
                )}
                {canComplete && (
                  <button onClick={handleComplete} disabled={loading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '9px 18px', borderRadius: '10px',
                      background: 'linear-gradient(135deg,#10b981,#059669)',
                      border: 'none', color: '#fff',
                      fontSize: '13px', fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                    }}>
                    <CheckCircle2 size={15} /> {loading ? 'Completing…' : 'Complete Consultation'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
