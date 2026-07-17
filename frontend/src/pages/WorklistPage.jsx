/**
 * pages/WorklistPage.jsx
 * -----------------------
 * Generic worklist dashboard used by Pharmacy, Laboratory, Radiology,
 * and Billing roles.
 *
 * Props:
 *   title      - panel heading
 *   icon       - lucide icon component
 *   fetchFn    - async function(token) → array of items
 *   columns    - array of { key, label, render? } column definitions
 *   emptyMsg   - message when no items exist
 *   statusColors - optional { [status]: { bg, color } } map
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import BackgroundBlobs from '../components/layout/BackgroundBlobs';
import DashboardHeader from '../components/layout/DashboardHeader';
import Alert from '../components/ui/Alert';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export { formatDate };

export default function WorklistPage({ title, Icon, fetchFn, columns, emptyMsg, bannerSubtitle }) {
  const { userProfile, token, logout } = useAuth();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErrorMsg('');
    try {
      const data = await fetchFn(token);
      setItems(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [token, fetchFn]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="root-wrapper">
      <BackgroundBlobs />
      <div className="dashboard-container">
        <DashboardHeader userProfile={userProfile} onLogout={logout} />
        <main className="dashboard-main">

          {/* Welcome banner */}
          <div className="welcome-banner" style={{ marginBottom: '24px' }}>
            <h2>{title}</h2>
            <p>{bannerSubtitle || `Welcome, `}
              <strong>{userProfile?.full_name || 'User'}</strong>
            </p>
          </div>

          {/* Worklist card */}
          <div className="card-panel">
            <div className="panel-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {Icon && <Icon size={18} />} {title}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
                <button onClick={load} title="Refresh"
                  style={{
                    background: 'none', border: '1px solid #e2e8f0',
                    borderRadius: '6px', padding: '4px 6px',
                    cursor: 'pointer', color: '#64748b', display: 'flex',
                  }}>
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            <Alert type="error" message={errorMsg} />

            {loading ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                Loading…
              </p>
            ) : items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                {Icon && <Icon size={36} style={{ marginBottom: '12px', opacity: 0.2 }} />}
                <p style={{ fontSize: '14px' }}>{emptyMsg || 'No items to display.'}</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      {columns.map(col => (
                        <th key={col.key} style={{
                          padding: '10px 14px', textAlign: 'left',
                          fontSize: '11px', fontWeight: 700,
                          color: '#64748b', textTransform: 'uppercase',
                          letterSpacing: '0.4px', whiteSpace: 'nowrap',
                        }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id ?? idx} style={{
                        borderBottom: '1px solid #f8fafc',
                        transition: 'background 0.1s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        {columns.map(col => (
                          <td key={col.key} style={{
                            padding: '12px 14px', color: '#334155',
                            verticalAlign: 'middle',
                          }}>
                            {col.render
                              ? col.render(item[col.key], item)
                              : col.key.includes('_at')
                                ? formatDate(item[col.key])
                                : item[col.key] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
