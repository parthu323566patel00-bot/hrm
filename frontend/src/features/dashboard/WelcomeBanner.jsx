/**
 * features/dashboard/WelcomeBanner.jsx
 * --------------------------------------
 * Dark gradient welcome strip shown at the top of the admin/general dashboard.
 *
 * Props:
 *   userProfile - The logged-in user object
 */

import React from 'react';
import { ROLE_LABELS } from '../../constants/roles';

export default function WelcomeBanner({ userProfile }) {
  const roleTitle = userProfile?.is_superuser
    ? 'Super Admin'
    : ROLE_LABELS[userProfile?.role_id] || 'Staff';

  return (
    <section className="welcome-banner">
      <h2>Welcome, {userProfile?.full_name || 'User'}</h2>
      <p>
        {roleTitle} · <strong>System Operational</strong> · {userProfile?.tenant_id}
      </p>
    </section>
  );
}
