/**
 * pages/DashboardPage.jsx
 * ------------------------
 * Main logged-in dashboard view.
 * Composes header, stats, appointments, and the role-conditional side panel.
 *
 * Side panel logic:
 *   - Super Admin / Hospital Admin  → InvitePanel (invite staff members)
 *   - Doctor (role_id 2)            → DoctorDepartments (select departments)
 *   - Everyone else                 → SecurityLog
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../constants/roles';
import BackgroundBlobs from '../components/layout/BackgroundBlobs';
import DashboardHeader from '../components/layout/DashboardHeader';
import WelcomeBanner from '../features/dashboard/WelcomeBanner';
import StatsGrid from '../features/dashboard/StatsGrid';
import AppointmentsList from '../features/dashboard/AppointmentsList';
import InvitePanel from '../features/dashboard/InvitePanel';
import DoctorDepartments from '../features/dashboard/DoctorDepartments';
import SecurityLog from '../features/dashboard/SecurityLog';

export default function DashboardPage() {
  const { userProfile, token, logout } = useAuth();

  // Users with role Super Admin (1) or Hospital Admin (2) can invite colleagues
  const canInvite =
    userProfile?.is_superuser ||
    userProfile?.role_id === ROLES.SUPER_ADMIN ||
    userProfile?.role_id === ROLES.HOSPITAL_ADMIN;

  // Doctors (role_id 4) manage their own department memberships
  const isDoctor = userProfile?.role_id === ROLES.DOCTOR;

  const renderSidePanel = () => {
    if (canInvite) return <InvitePanel token={token} />;
    if (isDoctor)  return <DoctorDepartments token={token} />;
    return <SecurityLog userProfile={userProfile} />;
  };

  const navigate = useNavigate();
  const showInventoryButton = userProfile?.role_id === ROLES.INVENTORY_MANAGER;

  return (
    <div className="root-wrapper">
      <BackgroundBlobs />

      <div className="dashboard-container">
        <DashboardHeader userProfile={userProfile} onLogout={logout} />

        <main className="dashboard-main">
          <WelcomeBanner userProfile={userProfile} />
          <StatsGrid />

          {showInventoryButton && (
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 20px',
                  borderRadius: '14px',
                  background: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                <ClipboardList size={16} />
                Open Procurement Dashboard
              </button>
            </div>
          )}

          <div className="dashboard-grid">
            <AppointmentsList />
            {renderSidePanel()}
          </div>
        </main>
      </div>
    </div>
  );
}
