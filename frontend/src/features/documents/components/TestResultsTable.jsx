/**
 * TestResultsTable — lab test results with colour-coded status indicators.
 * Supports search, sorting, sticky header, abnormal highlighting.
 */
import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import StatusBadge from './StatusBadge';

const ROW_BG = {
  normal:     'transparent',
  high:       'rgba(239,68,68,0.04)',
  low:        'rgba(59,130,246,0.04)',
  critical:   'rgba(219,39,119,0.06)',
  borderline: 'rgba(245,158,11,0.04)',
  unknown:    'transparent',
};

export default React.memo(function TestResultsTable({ tests = [] }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return tests
      .filter(t => !q || t.name?.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = (a[sortKey] || '').toString().toLowerCase();
        const bv = (b[sortKey] || '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [tests, query, sortKey, sortDir]);

  const abnormal = tests.filter(t => ['high','low','critical','borderline'].includes(t.status));

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const thStyle = {
    padding: '10px 14px', textAlign: 'left', fontSize: '11px',
    fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
    letterSpacing: '0.4px', background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0', cursor: 'pointer',
    userSelect: 'none', whiteSpace: 'nowrap',
  };

  if (!tests.length) return (
    <p style={{ color: '#94a3b8', fontSize: '13px' }}>No test results extracted.</p>
  );

  return (
    <div>
      {/* Abnormal summary */}
      {abnormal.length > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px', marginBottom: '14px',
          background: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '13px', color: '#991b1b', fontWeight: 600,
        }}>
          ⚠ {abnormal.length} abnormal result{abnormal.length > 1 ? 's' : ''}:{' '}
          {abnormal.map(t => t.name).join(', ')}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '12px', maxWidth: '280px' }}>
        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search tests…"
          style={{
            width: '100%', padding: '7px 10px 7px 30px', borderRadius: '8px',
            border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none',
            background: '#f8fafc', color: '#0f172a',
          }}
        />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {[['name','Test Name'],['result','Result'],['unit','Unit'],['reference','Reference'],['status','Status']].map(([key, label]) => (
                <th key={key} style={thStyle} onClick={() => toggleSort(key)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {label} <ArrowUpDown size={10} opacity={0.5} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i} style={{
                background: ROW_BG[t.status] || 'transparent',
                borderBottom: '1px solid #f1f5f9',
              }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{t.name}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: t.status === 'high' ? '#ef4444' : t.status === 'low' ? '#3b82f6' : '#0f172a' }}>
                  {t.result || '—'}
                </td>
                <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.unit || '—'}</td>
                <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.reference || '—'}</td>
                <td style={{ padding: '10px 14px' }}><StatusBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
        Showing {filtered.length} of {tests.length} tests
      </p>
    </div>
  );
});
