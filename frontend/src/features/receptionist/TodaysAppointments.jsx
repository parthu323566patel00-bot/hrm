/**
 * features/receptionist/TodaysAppointments.jsx
 * -----------------------------------------------
 * Shows today's scheduled appointments.
 * Receptionist can check in a patient (status → checked_in)
 * or cancel an appointment from this panel.
 *
 * Props:
 *   token      - JWT bearer token
 *   refreshKey - increment to force a re-fetch
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck, Clock, User, Stethoscope,
  CheckCircle2, XCircle, RefreshCw, Building2,
} from 'lucide-react';
import {
  listTodayAppointments,
  checkInAppointment,
  cancelAppointment,
} from '../../services/appointmentService';
import Alert from '../../components/ui/Alert';

const STATUS_STYLES = {
  scheduled:   { bg: '#eff6ff', color: '#1d4ed8', label: 'Scheduled' },
  checked_in:  { bg: '#d1fae5', color: '#065f46', label: 'Checked In' },
  in_progress: { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
  completed:   { bg: '#f0fdf4', color: '#15803d', label: 'Completed'  },
  cancelled:   { bg: '#fef2f2', color: '#991b1b', label: 'Cancelled'  },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.scheduled;
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '2px 8px',
      borderRadius: '20px', background: s.bg, color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

export default function TodaysAppointments({ token, refreshKey }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');
  const [successMsg, setSuccessMsg]     = useState('');
  const [actingId, setActingId]         = useState(null); // which row is being acted on

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await listTodayAppointments(token);
      setAppointments(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleCheckIn = async (id) => {
    setActingId(id);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await checkInAppointment(token, id);
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status: 'checked_in' } : a)
      );
      setSuccessMsg('Patient checked in successfully.');
    } catch (err) {
      setErrorMsg(err.message || 'Check-in failed.');
    } finally {
      setActingId(null);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return;
    setActingId(id);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await cancelAppointment(token, id);
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a)
      );
      setSuccessMsg('Appointment cancelled.');
    } catch (err) {
      setErrorMsg(err.message || 'Cancellation failed.');
    } finally {
      setActingId(null);
    }
  };

  // Counts
  const scheduled  = appointments.filter(a => a.status === 'scheduled').length;
  const checkedIn  = appointments.filter(a => a.status === 'checked_in').length;
  const completed  = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="card-panel" style={{ marginTop: '24px' }}>

      {/* Header */}
      <div className="panel-header">
        <h3 style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <CalendarCheck size={18} /> Today's Appointments
        </h3>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {/* Mini stats */}
          <span style={{ fontSize:'11px', color:'#64748b' }}>
            <strong style={{ color:'#1d4ed8' }}>{scheduled}</strong> scheduled ·{' '}
            <strong style={{ color:'#065f46' }}>{checkedIn}</strong> checked in ·{' '}
            <strong style={{ color:'#15803d' }}>{completed}</strong> done
          </span>
          <button
            onClick={load}
            title="Refresh"
            style={{
              background: 'none', border: '1px solid #e2e8f0',
              borderRadius: '6px', padding: '4px 6px',
              cursor: 'pointer', color: '#64748b', display:'flex',
            }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Date label */}
      <p style={{ fontSize:'12px', color:'#94a3b8', marginBottom:'14px', marginTop:'-8px' }}>
        {todayLabel}
      </p>

      <Alert type="error"   message={errorMsg}   />
      <Alert type="success" message={successMsg} />

      {loading ? (
        <p style={{ fontSize:'13px', color:'#94a3b8', textAlign:'center', padding:'24px 0' }}>
          Loading…
        </p>
      ) : appointments.length === 0 ? (
        <p style={{ fontSize:'13px', color:'#94a3b8', textAlign:'center', padding:'24px 0' }}>
          No appointments scheduled for today.
        </p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {appointments.map(appt => {
            const isCancelled  = appt.status === 'cancelled';
            const isCheckedIn  = appt.status === 'checked_in';
            const isCompleted  = appt.status === 'completed' || appt.status === 'in_progress';
            const canCheckIn   = appt.status === 'scheduled';
            const canCancel    = appt.status === 'scheduled';
            const acting       = actingId === appt.id;

            return (
              <div
                key={appt.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr auto',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  background: isCancelled ? '#fafafa' : canCheckIn ? '#f8fafc' : '#fff',
                  opacity: isCancelled ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {/* Time */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '14px', fontWeight: 800,
                    color: isCancelled ? '#94a3b8' : 'var(--color-primary)',
                  }}>
                    {appt.time_slot}
                  </div>
                  <Clock size={11} style={{ color: '#94a3b8', marginTop: '2px' }} />
                </div>

                {/* Details */}
                <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'14px', fontWeight:700, color:'#0f172a' }}>
                      {appt.patient_name}
                    </span>
                    <StatusBadge status={appt.status} />
                  </div>
                  <div style={{ display:'flex', gap:'14px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'12px', color:'#64748b', display:'flex', alignItems:'center', gap:'4px' }}>
                      <Stethoscope size={11} /> {appt.doctor_name}
                    </span>
                    {appt.department_name && (
                      <span style={{ fontSize:'12px', color:'#64748b', display:'flex', alignItems:'center', gap:'4px' }}>
                        <Building2 size={11} /> {appt.department_name}
                      </span>
                    )}
                  </div>
                  {appt.notes && (
                    <p style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px', fontStyle:'italic' }}>
                      {appt.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', flexShrink:0 }}>
                  {canCheckIn && (
                    <button
                      onClick={() => handleCheckIn(appt.id)}
                      disabled={acting}
                      style={{
                        display:'flex', alignItems:'center', gap:'5px',
                        padding:'6px 12px', borderRadius:'8px',
                        background:'linear-gradient(135deg,#10b981,#059669)',
                        border:'none', color:'#fff',
                        fontSize:'12px', fontWeight:700,
                        cursor: acting ? 'not-allowed' : 'pointer',
                        opacity: acting ? 0.7 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <CheckCircle2 size={13} />
                      {acting ? '…' : 'Check In'}
                    </button>
                  )}
                  {canCancel && (
                    <button
                      onClick={() => handleCancel(appt.id)}
                      disabled={acting}
                      style={{
                        display:'flex', alignItems:'center', gap:'5px',
                        padding:'6px 12px', borderRadius:'8px',
                        background:'#fef2f2', border:'1px solid #fecaca',
                        color:'#ef4444', fontSize:'12px', fontWeight:700,
                        cursor: acting ? 'not-allowed' : 'pointer',
                        opacity: acting ? 0.7 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <XCircle size={13} />
                      Cancel
                    </button>
                  )}
                  {isCheckedIn && (
                    <span style={{ fontSize:'12px', color:'#065f46', fontWeight:700,
                      display:'flex', alignItems:'center', gap:'4px' }}>
                      <CheckCircle2 size={13}/> Checked In
                    </span>
                  )}
                  {isCompleted && (
                    <span style={{ fontSize:'12px', color:'#15803d', fontWeight:700 }}>
                      Completed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
