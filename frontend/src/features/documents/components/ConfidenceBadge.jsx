import React from 'react';

export default React.memo(function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? '#166534' : pct >= 50 ? '#92400e' : '#991b1b';
  const bg    = pct >= 80 ? '#dcfce7' : pct >= 50 ? '#fef3c7' : '#fee2e2';
  return (
    <span title="Parser confidence score" style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
      fontWeight: 700, background: bg, color,
    }}>
      ◑ {pct}% confidence
    </span>
  );
});
