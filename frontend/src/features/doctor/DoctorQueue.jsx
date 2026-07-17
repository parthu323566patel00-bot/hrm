/**
 * features/doctor/DoctorQueue.jsx
 * ---------------------------------
 * Shows the logged-in doctor's appointments with tab filters:
 *   Today | Upcoming | Past | All
 *
 * Status transitions the doctor can perform:
 *   checked_in  → in_progress  (Start)
 *   in_progress → completed    (Complete)
 *
 * Props:
 *   token      - JWT bearer token
 *   doctorId   - current user id
 *   refreshKey - increment to force reload
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope, Clock, RefreshCw, PlayCircle,
  CheckCircle2, Building2, FileText, Calendar, ClipboardList,
} from 'lucide-react';
import { listMyAppointments } from '../../services/appointmentService';
import { apiFetch } from '../../services/api';
import Alert from '../../components/ui/Alert';
import PatientChart from './PatientChart';

/* ── Constants ──────────────────────────────────────────────────────────── */
const STATUS_META = {
  scheduled:   { bg: '#eff6ff', color: '#1d4ed8', label: 'Scheduled'   },
  checked_in:  { bg: '#fef3c7', color: '#92400e', label: 'Checked In'  },
  in_progress: { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
  completed:   { bg: '#d1fae5', color: '#065f46', label: 'Completed'   },
  cancelled:   { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled'   },
};

const TABS = [
  { key: 'today',    label: 'Today'    },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past',     label: 'Past'     },
  { key: 'all',      label: 'All'      },
];

/* ── Helpers ────────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.scheduled;
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '2px 9px',
      borderRadius: '20px', background: m.bg, color: m.color,
      whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

async function patchStatus(token, apptId, newStatus) {
  return apiFetch(
    `/appointments/${apptId}`,
    { method: 'PATCH', body: JSON.stringify({ status: newStatus }) },
    token,
  );
}

/* ── Component ──────────────────────────────────────────────────────────── */
export default function DoctorQueue({ token, doctorId, refreshKey }) {
  const [tab, setTab]               = useState('today');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actingId, setActingId]     = useState(null);
  const [openChart, setOpenChart]   = useState(null); // appointment object

  const load = useCallback(async (activeTab) => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const data = await listMyAppointments(token, activeTab);
      setAppointments(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Reload on tab change or external refreshKey
  useEffect(() => { load(tab); }, [load, tab, refreshKey]);

  const handleTabChange = (key) => {
    setTab(key);
    setAppointments([]);
  };

  const handleStatusChange = async (apptId, newStatus) => {
    setActingId(apptId);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await patchStatus(token, apptId, newStatus);
      setAppointments(prev =>
        prev.map(a => a.id === apptId ? { ...a, status: newStatus } : a)
      );
      const labels = { in_progress: 'Consultation started.', completed: 'Consultation completed.' };
      setSuccessMsg(labels[newStatus] || 'Status updated.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update status.');
    } finally {
      setActingId(null);
    }
  };

  // Counts for today tab header
  const waiting    = appointments.filter(a => a.status === 'checked_in').length;
  const inProgress = appointments.filter(a => a.status === 'in_progress').length;
  const done       = appointments.filter(a => a.status === 'completed').length;
  const total      = appointments.filter(a => a.status !== 'cancelled').length;

  // Group upcoming/all/past by date
  const grouped = appointments.reduce((acc, a) => {
    const key = a.appointment_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
  const groupedDates = Object.keys(grouped).sort();
  const useGrouped = tab !== 'today';

  return (
    <div className="card-panel">
      {/* ... existing header, tabs, content ... */}

      {/* Header */}
      <div className="panel-header">
        <h3><Stethoscope size={18} /> My Appointments</h3>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {tab === 'today' && total > 0 && (
            <span style={{ fontSize:'11px', color:'#64748b' }}>
              <strong style={{ color:'#92400e' }}>{waiting}</strong> waiting ·{' '}
              <strong style={{ color:'#1e40af' }}>{inProgress}</strong> in progress ·{' '}
              <strong style={{ color:'#065f46' }}>{done}</strong> done
              <span style={{ color:'#94a3b8' }}> / {total}</span>
            </span>
          )}
          <button onClick={() => load(tab)} title="Refresh"
            style={{
              background:'none', border:'1px solid #e2e8f0',
              borderRadius:'6px', padding:'4px 6px',
              cursor:'pointer', color:'#64748b', display:'flex',
            }}>
            <RefreshCw size={13}/>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        background: '#f1f5f9', borderRadius: '10px', padding: '4px',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => handleTabChange(t.key)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: '7px',
              border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? 'var(--color-primary)' : '#64748b',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <Alert type="error"   message={errorMsg}   />
      <Alert type="success" message={successMsg} />

      {/* Content */}
      {loading ? (
        <p style={{ fontSize:'13px', color:'#94a3b8', textAlign:'center', padding:'32px 0' }}>
          Loading…
        </p>
      ) : appointments.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8' }}>
          <Stethoscope size={32} style={{ marginBottom:'10px', opacity:0.3 }}/>
          <p style={{ fontSize:'13px' }}>
            {tab === 'today'    && 'No appointments scheduled for today.'}
            {tab === 'upcoming' && 'No upcoming appointments.'}
            {tab === 'past'     && 'No past appointments.'}
            {tab === 'all'      && 'No appointments found.'}
          </p>
        </div>
      ) : useGrouped ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
          {groupedDates.map(dateKey => (
            <div key={dateKey}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                <Calendar size={13} style={{ color:'var(--color-primary)' }}/>
                <span style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}>
                  {formatDate(dateKey)}
                </span>
                <span style={{ fontSize:'11px', color:'#94a3b8', background:'#f1f5f9', padding:'1px 7px', borderRadius:'20px' }}>
                  {grouped[dateKey].length} appt{grouped[dateKey].length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {grouped[dateKey].map(appt => (
                  <AppointmentRow key={appt.id} appt={appt}
                    acting={actingId === appt.id}
                    onStatusChange={handleStatusChange}
                    onOpenChart={() => setOpenChart(appt)}
                    showActions={tab !== 'past'} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {appointments.map(appt => (
            <AppointmentRow key={appt.id} appt={appt}
              acting={actingId === appt.id}
              onStatusChange={handleStatusChange}
              onOpenChart={() => setOpenChart(appt)}
              showActions />
          ))}
        </div>
      )}

      {/* Patient Chart modal */}
      {openChart && (
        <PatientChart
          appointment={openChart}
          token={token}
          onClose={() => setOpenChart(null)}
          onVisitUpdate={() => load(tab)}
        />
      )}
    </div>
  );
}

/* ── Reusable appointment row ────────────────────────────────────────────── */
function AppointmentRow({ appt, acting, onStatusChange, onOpenChart, showActions }) {
  const cancelled   = appt.status === 'cancelled';
  const canStart    = appt.status === 'checked_in';
  const canComplete = appt.status === 'in_progress';
  const canOpen     = appt.status === 'checked_in' || appt.status === 'in_progress';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '56px 1fr auto',
      alignItems: 'center',
      gap: '12px',
      padding: '13px 16px',
      borderRadius: '12px',
      border: `1px solid ${canStart ? '#fcd34d' : canComplete ? '#93c5fd' : 'var(--color-border)'}`,
      background: canStart ? '#fffbeb' : canComplete ? '#eff6ff' : '#f8fafc',
      opacity: cancelled ? 0.5 : 1,
      transition: 'all 0.15s',
    }}>

      {/* Time */}
      <div style={{ textAlign:'center' }}>
        <div style={{
          fontSize:'14px', fontWeight:800,
          color: cancelled ? '#94a3b8' : 'var(--color-primary)',
        }}>
          {appt.time_slot}
        </div>
        <Clock size={11} style={{ color:'#94a3b8', marginTop:'2px' }}/>
      </div>

      {/* Info */}
      <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <span style={{ fontSize:'14px', fontWeight:700, color:'#0f172a' }}>
            {appt.patient_name}
          </span>
          <StatusBadge status={appt.status}/>
        </div>
        {appt.department_name && (
          <span style={{ fontSize:'12px', color:'#64748b', display:'flex', alignItems:'center', gap:'4px' }}>
            <Building2 size={11}/> {appt.department_name}
          </span>
        )}
        {appt.notes && (
          <p style={{ fontSize:'11px', color:'#94a3b8', fontStyle:'italic',
            display:'flex', alignItems:'flex-start', gap:'4px', marginTop:'2px' }}>
            <FileText size={11} style={{ marginTop:'1px', flexShrink:0 }}/> {appt.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display:'flex', flexDirection:'column', gap:'6px', flexShrink:0 }}>

        {/* Open Chart — primary CTA for checked_in and in_progress */}
        {canOpen && showActions && (
          <button
            onClick={() => onOpenChart?.()}
            style={{
              display:'flex', alignItems:'center', gap:'5px',
              padding:'7px 14px', borderRadius:'8px',
              background: canStart
                ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
                : 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
              border:'none', color:'#fff', fontSize:'12px', fontWeight:700,
              cursor:'pointer', whiteSpace:'nowrap',
            }}
          >
            <ClipboardList size={13}/>
            {canStart ? 'Open Chart' : 'Resume Chart'}
          </button>
        )}

        {appt.status === 'completed' && (
          <span style={{ fontSize:'12px', color:'#065f46', fontWeight:700,
            display:'flex', alignItems:'center', gap:'4px' }}>
            <CheckCircle2 size={13}/> Done
          </span>
        )}
        {appt.status === 'scheduled' && showActions && (
          <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:500 }}>
            Awaiting check-in
          </span>
        )}
        {cancelled && (
          <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:500 }}>
            Cancelled
          </span>
        )}
      </div>
    </div>
  );
}
