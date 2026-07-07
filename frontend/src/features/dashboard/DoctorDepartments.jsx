/**
 * features/dashboard/DoctorDepartments.jsx
 * ------------------------------------------
 * Department self-assignment panel shown to Doctors on the dashboard.
 * Allows a doctor to select one or more departments they belong to.
 * Uses a many-to-many relationship — one doctor can be in many departments,
 * one department can have many doctors.
 *
 * Props:
 *   token - JWT bearer token of the logged-in doctor
 */

import React, { useState, useEffect } from 'react';
import { Stethoscope, Check } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { fetchMyDepartments, updateMyDepartments } from '../../services/userService';
import Alert from '../../components/ui/Alert';

export default function DoctorDepartments({ token }) {
  const [allDepartments, setAllDepartments]   = useState([]);
  const [selectedIds, setSelectedIds]         = useState(new Set());
  const [successMsg, setSuccessMsg]           = useState('');
  const [errorMsg, setErrorMsg]               = useState('');
  const [loading, setLoading]                 = useState(false);
  const [saving, setSaving]                   = useState(false);

  // Load available departments and current memberships on mount
  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoading(true);
      try {
        const [depts, myDepts] = await Promise.all([
          apiFetch('/departments/', {}, token),
          fetchMyDepartments(token),
        ]);
        setAllDepartments(depts);
        setSelectedIds(new Set(myDepts.map(d => d.id)));
      } catch (err) {
        setErrorMsg('Failed to load departments. Please refresh.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const toggleDepartment = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // Clear status messages when the selection changes
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await updateMyDepartments(token, [...selectedIds]);
      setSuccessMsg('Department assignments saved.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save department assignments.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <h3>
          <Stethoscope size={18} />
          My Departments
        </h3>
      </div>

      <Alert type="error"   message={errorMsg}   />
      <Alert type="success" message={successMsg} />

      {loading ? (
        <p style={{ color: '#64748b', fontSize: '14px', padding: '8px 0' }}>
          Loading departments…
        </p>
      ) : (
        <>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '12px' }}>
            Select all departments you are assigned to. You can be a member of multiple departments.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {allDepartments.map(dept => {
              const isSelected = selectedIds.has(dept.id);
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => toggleDepartment(dept.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${isSelected ? 'var(--color-primary)' : '#e2e8f0'}`,
                    background: isSelected ? 'var(--color-primary-light, #eff6ff)' : '#f8fafc',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  aria-pressed={isSelected}
                >
                  <span>
                    <span style={{
                      fontWeight: 600,
                      fontSize: '13px',
                      color: isSelected ? 'var(--color-primary)' : '#334155',
                    }}>
                      {dept.name}
                    </span>
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '11px',
                      color: '#94a3b8',
                      background: '#f1f5f9',
                      padding: '1px 6px',
                      borderRadius: '4px',
                    }}>
                      {dept.code}
                    </span>
                  </span>
                  {isSelected && (
                    <Check size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="submit-btn"
            style={{ padding: '10px', width: '100%' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Department Assignments'}
          </button>
        </>
      )}
    </div>
  );
}
