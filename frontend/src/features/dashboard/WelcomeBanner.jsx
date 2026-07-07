/**
 * features/dashboard/WelcomeBanner.jsx
 * --------------------------------------
 * Dark gradient welcome strip shown at the top of the admin/general dashboard.
 *
 * Props:
 *   userProfile - The logged-in user object
 */

import React from 'react';

const ROLE_TITLES = {
  1: 'Super Admin',
  2: 'Hospital Admin',
  3: 'Receptionist',
  4: 'Doctor',
  5: 'Nurse',
  6: 'Lab Technician',
  7: 'Radiologist',
  8: 'Pharmacist',
  9: 'Billing Clerk',
  10: 'Inventory Manager',
};

export default function WelcomeBanner({ userProfile }) {
  const roleTitle = userProfile?.is_superuser
    ? 'Super Admin'
    : ROLE_TITLES[userProfile?.role_id] || 'Staff';

  return (
    <section className="welcome-banner">
      <h2>Welcome, {userProfile?.full_name || 'User'}</h2>
      <p>
        {roleTitle} · <strong>System Operational</strong> · {userProfile?.tenant_id}
      </p>
    </section>
  );
}
