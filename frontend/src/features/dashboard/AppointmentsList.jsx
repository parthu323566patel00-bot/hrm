/**
 * features/dashboard/AppointmentsList.jsx
 * -----------------------------------------
 * Panel showing today's real appointments fetched live from the API.
 * Displays doctor name, patient name, department, time slot and status.
 * Auto-refreshes on mount; manual refresh button available.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, RefreshCw, Stethoscope } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { listTodayAppointments } from '../../services/appointmentService';

/* ── Status badge config ─────────────────────────────────────────────────── */
const STATUS_MAP = {
  scheduled:   { css: 'pending',  label: 'Scheduled'   },
  checked_in:  { css: 'checked',  label: 'Checked In'  },
  in_progress: { css: 'progress', label: 'In Progress' },
  completed:   { css: 'checked',  label: 'Completed'   },
  cancelled:   { css: 'pending',  label: 'Cancelled'   },
};

/* ── Convert "HH:MM" (24h) → "HH:MM AM/PM" ─────────────────────────────── */
function to12h(slot) {
  if (!slot) return '—';
  const [h, m] = slot.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12    = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default function AppointmentsList() {
  const { token } = useAuth();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await listTodayAppointments(token);
      setAppointments(data);
    } catch (err) {
      setError(err.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="card-panel">
      <div className="panel-header">
        <h3>
          <Calendar size={18} />
          Today's Scheduled Appointments
        </h3>
        <button
          className="panel-action"
          onClick={load}
          title="Refresh"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
          Loading appointments…
        </p>
      )}

      {/* Error */}
      {!loading && error && (
        <p style={{ fontSize: '13px', color: '#ef4444', textAlign: 'center', padding: '16px 0' }}>
          {error}
        </p>
      )}

      {/* Empty */}
      {!loading && !error && appointments.length === 0 && (
        <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8' }}>
          <Calendar size={28} style={{ marginBottom: '8px', opacity: 0.3 }} />
          <p style={{ fontSize: '13px' }}>No appointments scheduled for today.</p>
        </div>
      )}

      {/* List */}
      {!loading && !error && appointments.length > 0 && (
        <div className="appointments-list">
          {appointments.map(appt => {
            const sm        = STATUS_MAP[appt.status] || STATUS_MAP.scheduled;
            const cancelled = appt.status === 'cancelled';

            return (
              <div
                className="appointment-item"
                key={appt.id}
                style={{ opacity: cancelled ? 0.5 : 1 }}
              >
                {/* Time */}
                <div className="time">
                  <Clock size={13} /> {to12h(appt.time_slot)}
                </div>

                {/* Details */}
                <div className="details">
                  <h4>
                    {appt.doctor_name}
                    {appt.department_name && (
                      <span style={{
                        marginLeft: '6px', fontSize: '11px',
                        color: '#64748b', fontWeight: 500,
                      }}>
                        ({appt.department_name})
                      </span>
                    )}
                  </h4>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Stethoscope size={11} />
                    {appt.patient_name}
                    {appt.notes && (
                      <span style={{ color: '#94a3b8' }}> • {appt.notes}</span>
                    )}
                  </p>
                </div>

                {/* Status badge */}
                <span className={`status-badge ${sm.css}`}>
                  {sm.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
