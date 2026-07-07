/**
 * components/layout/DashboardHeader.jsx
 * ----------------------------------------
 * Sticky top navigation bar shared by all role-specific pages.
 * Clicking the avatar opens the EditProfilePanel slide-in drawer.
 *
 * Props:
 *   userProfile - The logged-in user object
 *   onLogout    - Logout handler
 */

import React, { useState } from 'react';
import { LogOut, User, ChevronDown } from 'lucide-react';
import Logo from './Logo';
import EditProfilePanel from '../../features/profile/EditProfilePanel';

const ROLE_LABELS = {
  1: 'Super Admin', 2: 'Hospital Admin', 3: 'Receptionist',
  4: 'Doctor',      5: 'Nurse',          6: 'Lab Technician',
  7: 'Radiologist', 8: 'Pharmacist',     9: 'Billing Clerk',
  10: 'Inventory Manager',
};

export default function DashboardHeader({ userProfile, onLogout }) {
  const [showProfile, setShowProfile] = useState(false);

  const roleLabel = userProfile?.is_superuser
    ? 'Super Admin'
    : ROLE_LABELS[userProfile?.role_id] || 'Staff';

  return (
    <>
      <header className="dashboard-header">
        <Logo size={28} badge="Clinical Hub" />

        <div className="profile-actions">
          {/* Clickable avatar — opens Edit Profile panel */}
          <button
            onClick={() => setShowProfile(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'none', border: '1px solid #e2e8f0',
              borderRadius: '12px', padding: '6px 12px 6px 6px',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.background = 'var(--color-primary-light)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.background = 'none';
            }}
            title="Edit profile"
          >
            <div className="avatar">
              <User size={16} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <p className="name" style={{ fontSize: '13px' }}>
                {userProfile?.full_name || 'User Profile'}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>
                {roleLabel} · {userProfile?.tenant_id}
              </p>
            </div>
            <ChevronDown size={14} style={{ color: '#94a3b8', marginLeft: '2px' }} />
          </button>

          <button onClick={onLogout} className="logout-btn" title="Sign Out">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {/* Edit Profile slide-in panel */}
      {showProfile && (
        <EditProfilePanel onClose={() => setShowProfile(false)} />
      )}
    </>
  );
}
