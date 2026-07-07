/**
 * features/receptionist/PatientsList.jsx
 * ----------------------------------------
 * Searchable, paginated list of registered patients (7 per page).
 * Clicking a patient name opens PatientDetailModal (view + edit).
 *
 * Props:
 *   token      - JWT bearer token
 *   refreshKey - Increment to re-fetch after a new registration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Users, Droplets, Phone,
  User, Calendar, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { listPatients, countPatients } from '../../services/patientService';
import PatientDetailModal from './PatientDetailModal';
import Alert from '../../components/ui/Alert';

const PAGE_SIZE = 7;

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const GENDER_COLORS = {
  Male:   { bg: '#dbeafe', color: '#1d4ed8' },
  Female: { bg: '#fce7f3', color: '#9d174d' },
  Other:  { bg: '#f3f4f6', color: '#374151' },
};

/* ── Pagination bar ────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, onPrev, onNext, onGo }) {
  if (totalPages <= 1) return null;

  // Build page number buttons — show at most 5 around current
  const pages = [];
  const delta = 2;
  const left  = Math.max(1, page - delta);
  const right = Math.min(totalPages, page + delta);

  if (left > 1)          { pages.push(1); if (left > 2) pages.push('…'); }
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages){ if (right < totalPages - 1) pages.push('…'); pages.push(totalPages); }

  const btnBase = {
    minWidth: '32px', height: '32px', borderRadius: '8px',
    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid #e2e8f0', background: '#fff', color: '#475569',
    transition: 'all 0.15s',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '4px', paddingTop: '16px', borderTop: '1px solid #f1f5f9',
      marginTop: '12px',
    }}>
      {/* Prev */}
      <button
        onClick={onPrev} disabled={page === 1}
        style={{ ...btnBase, opacity: page === 1 ? 0.4 : 1, padding: '0 8px' }}
      >
        <ChevronLeft size={14} />
      </button>

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} style={{ color: '#94a3b8', fontSize: '12px', padding: '0 4px' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onGo(p)}
            style={{
              ...btnBase,
              background: p === page ? 'var(--color-primary)' : '#fff',
              color:      p === page ? '#fff' : '#475569',
              borderColor: p === page ? 'var(--color-primary)' : '#e2e8f0',
            }}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={onNext} disabled={page === totalPages}
        style={{ ...btnBase, opacity: page === totalPages ? 0.4 : 1, padding: '0 8px' }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function PatientsList({ token, refreshKey }) {
  const [patients, setPatients]             = useState([]);
  const [total, setTotal]                   = useState(0);
  const [query, setQuery]                   = useState('');
  const [page, setPage]                     = useState(1);
  const [loading, setLoading]               = useState(false);
  const [errorMsg, setErrorMsg]             = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (q, pg) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const skip = (pg - 1) * PAGE_SIZE;
      const [data, countData] = await Promise.all([
        listPatients(token, q, skip, PAGE_SIZE),
        countPatients(token, q),
      ]);
      setPatients(data);
      setTotal(countData.total);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load patients.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Reload on new registration (go back to page 1)
  useEffect(() => {
    setPage(1);
    load(query, 1);
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search — reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load(query, 1);
    }, 350);
    return () => clearTimeout(t);
  }, [query, load]);

  // Page change
  const goTo = (pg) => {
    setPage(pg);
    load(query, pg);
  };

  const handlePatientUpdated = (updated) => {
    setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedPatient(updated);
  };

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end   = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <div className="card-panel" style={{ marginTop: '24px' }}>

        {/* Header */}
        <div className="panel-header">
          <h3><Users size={18} /> Registered Patients</h3>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
            {total} record{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Search */}
        <div className="input-wrapper" style={{ marginBottom: '16px' }}>
          <Search className="input-icon" size={15} style={{ left: '12px' }} />
          <input
            type="text"
            className="form-input"
            style={{ padding: '10px 10px 10px 36px' }}
            placeholder="Search by name, phone, or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <Alert type="error" message={errorMsg} />

        {loading ? (
          <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
            Loading patients…
          </p>
        ) : patients.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
            {query ? 'No patients match your search.' : 'No patients registered yet.'}
          </p>
        ) : (
          <>
            {/* Showing X–Y of Z */}
            <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
              Showing {start}–{end} of {total}
            </p>

            {/* Patient rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {patients.map(p => {
                const gs = GENDER_COLORS[p.gender] || GENDER_COLORS.Other;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr auto',
                      alignItems: 'center', padding: '12px 14px',
                      background: '#f8fafc', border: '1px solid var(--color-border)',
                      borderRadius: '12px', gap: '12px', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.borderColor = 'rgba(0,172,193,0.25)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                  >
                    {/* Left */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {/* Name + badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setSelectedPatient(p)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            fontSize: '14px', fontWeight: 700,
                            color: 'var(--color-primary)', cursor: 'pointer',
                            textDecoration: 'underline',
                            textDecorationColor: 'rgba(0,172,193,0.4)',
                            textUnderlineOffset: '3px',
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary-hover)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-primary)'}
                          title="View / Edit patient"
                        >
                          {p.name}
                        </button>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '1px 7px',
                          borderRadius: '20px', background: gs.bg, color: gs.color,
                        }}>
                          {p.gender}
                        </span>
                        {p.blood_group && (
                          <span style={{
                            fontSize: '11px', fontWeight: 700, padding: '1px 7px',
                            borderRadius: '20px', background: '#fee2e2', color: '#991b1b',
                            display: 'flex', alignItems: 'center', gap: '3px',
                          }}>
                            <Droplets size={10} /> {p.blood_group}
                          </span>
                        )}
                        {p.allergies && (
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '1px 7px',
                            borderRadius: '20px', background: '#fef3c7', color: '#92400e',
                          }}>
                            ⚠ Allergies
                          </span>
                        )}
                      </div>
                      {/* Sub-details */}
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={11} /> Age {p.age}
                        </span>
                        <span style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={11} /> {p.phone}
                        </span>
                        {p.email && (
                          <span style={{ fontSize: '12px', color: '#475569' }}>{p.email}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: date + ID */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        <Calendar size={11} /> {formatDate(p.created_at)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>#{p.id}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination bar */}
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrev={() => goTo(page - 1)}
              onNext={() => goTo(page + 1)}
              onGo={goTo}
            />
          </>
        )}
      </div>

      {/* Detail / Edit Modal */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          token={token}
          onClose={() => setSelectedPatient(null)}
          onUpdated={handlePatientUpdated}
        />
      )}
    </>
  );
}
