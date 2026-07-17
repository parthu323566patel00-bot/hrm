/**
 * pages/NursePage.jsx
 * ---------------------
 * Dedicated dashboard for the Nurse role (role_id = 3).
 *
 * Shows:
 *   - Welcome banner
 *   - NurseQueue — today's checked-in and in-progress patients
 *   - Clicking a patient opens CarePlanModal (vitals, orders, procedures, discharge)
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import BackgroundBlobs from '../components/layout/BackgroundBlobs';
import DashboardHeader from '../components/layout/DashboardHeader';
import NurseQueue from '../features/nurse/NurseQueue';
import PatientsList from '../features/receptionist/PatientsList';

export default function NursePage() {
  const { userProfile, token, logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'search'

  return (
    <div className="root-wrapper">
      <BackgroundBlobs />

      <div className="dashboard-container">
        <DashboardHeader userProfile={userProfile} onLogout={logout} />

        <main className="dashboard-main">
          {/* Welcome banner */}
          <div className="welcome-banner" style={{ marginBottom: '24px' }}>
            <h2>Nurse Station</h2>
            <p>
              Welcome, <strong>{userProfile?.full_name || 'Nurse'}</strong> —
              today's ward patients are listed below. Open a care plan to
              record vitals, log procedures, or prepare discharge.
            </p>
          </div>

          {/* Toggle switcher */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', maxWidth: '320px' }}>
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
              Today's Ward Queue
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
            <NurseQueue token={token} refreshKey={refreshKey} />
          ) : (
            <PatientsList token={token} />
          )}
        </main>
      </div>
    </div>
  );
}
