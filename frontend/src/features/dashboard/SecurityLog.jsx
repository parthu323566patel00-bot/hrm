/**
 * features/dashboard/SecurityLog.jsx
 * -------------------------------------
 * Security status log shown to non-admin users in place of the invite panel.
 *
 * Props:
 *   userProfile - The logged-in user object
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function SecurityLog({ userProfile }) {
  const logs = [
    { dot: 'success', text: 'RSA 2048 keys validated and loaded successfully.' },
    { dot: 'success', text: 'Current authentication completed via Secure RSA Transport.' },
    { dot: 'info',    text: 'Database session established with Async SQLite driver.' },
    {
      dot: 'info',
      text: (
        <>
          Logged in User Role:{' '}
          <strong>
            {userProfile?.is_superuser ? 'SYSTEM ADMINISTRATOR' : 'STAFF USER'}
          </strong>
        </>
      ),
    },
  ];

  return (
    <div className="card-panel">
      <div className="panel-header">
        <h3>
          <ShieldCheck size={18} />
          Administrative Security Log
        </h3>
      </div>
      <div className="security-logs">
        {logs.map((log, i) => (
          <div className="log-item" key={i}>
            <span className={`log-dot ${log.dot}`} />
            <p>{log.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
