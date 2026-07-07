/**
 * pages/DoctorPage.jsx
 * ----------------------
 * Dedicated dashboard for the Doctor role (role_id = 4).
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

export default function DoctorPage() {
  const { userProfile, token, logout } = useAuth();
  const [queueRefresh, setQueueRefresh] = useState(0);

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

          {/* Two-column: departments left, queue right */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: '24px',
            alignItems: 'start',
          }}>
            {/* Left: department self-assignment */}
            <DoctorDepartments token={token} />

            {/* Right: today's live queue */}
            <DoctorQueue
              token={token}
              doctorId={userProfile?.id}
              refreshKey={queueRefresh}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
