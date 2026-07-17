/**
 * pages/DoctorPage.jsx
 * ----------------------
 * Dedicated dashboard for the Doctor role (role_id = 2).
 *
 * Left  — DoctorDepartments (manage which departments they belong to)
 * Right — DoctorQueue       (today's patient queue with status controls)
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import BackgroundBlobs from '../components/layout/BackgroundBlobs';
import DashboardHeader from '../components/layout/DashboardHeader';
import DoctorDepartments from '../features/dashboard/DoctorDepartments';
import DoctorQueue from '../features/doctor/DoctorQueue';
import PatientsList from '../features/receptionist/PatientsList';

export default function DoctorPage() {
  const { userProfile, token, logout } = useAuth();
  const [queueRefresh, setQueueRefresh] = useState(0);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'search'

  return (
    <div className="root-wrapper">
      <BackgroundBlobs />

      <div className="dashboard-container">
        <DashboardHeader userProfile={userProfile} onLogout={logout} />

        <main className="dashboard-main">
          {/* Welcome */}
          <div className="welcome-banner" style={{ marginBottom: '24px' }}>
            <h2>Doctor Console</h2>
            <p>
              Welcome, <strong>{userProfile?.full_name || 'Doctor'}</strong> — manage your departments and today's patient queue below.
            </p>
          </div>

          {/* Two-column: departments left, content right */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: '24px',
            alignItems: 'start',
          }}>
            {/* Left: department self-assignment */}
            <DoctorDepartments token={token} />

            {/* Right: toggle between queue and patient search */}
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', maxWidth: '320px' }}>
                <button
                  onClick={() => setActiveTab('queue')}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700,
                    background: activeTab === 'queue' ? '#fff' : 'transparent',
                    color: activeTab === 'queue' ? 'var(--color-primary)' : '#64748b',
                    boxShadow: activeTab === 'queue' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  Today's Queue
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700,
                    background: activeTab === 'search' ? '#fff' : 'transparent',
                    color: activeTab === 'search' ? 'var(--color-primary)' : '#64748b',
                    boxShadow: activeTab === 'search' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  Search Patients
                </button>
              </div>

              {activeTab === 'queue' ? (
                <DoctorQueue
                  token={token}
                  doctorId={userProfile?.id}
                  refreshKey={queueRefresh}
                />
              ) : (
                <PatientsList token={token} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
