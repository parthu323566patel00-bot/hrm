import React from 'react';

const STYLES = {
  normal:      { bg: '#dcfce7', color: '#166534', label: 'Normal'     },
  high:        { bg: '#fee2e2', color: '#991b1b', label: 'High'       },
  low:         { bg: '#dbeafe', color: '#1e40af', label: 'Low'        },
  critical:    { bg: '#fce7f7', color: '#9d174d', label: 'Critical'   },
  borderline:  { bg: '#fef3c7', color: '#92400e', label: 'Borderline' },
  unknown:     { bg: '#f1f5f9', color: '#475569', label: '—'          },
  // Document status
  READY:                  { bg: '#dcfce7', color: '#166534', label: 'Ready'             },
  PROCESSING:             { bg: '#dbeafe', color: '#1e40af', label: 'Processing'        },
  QUEUED:                 { bg: '#fef3c7', color: '#92400e', label: 'Queued'            },
  FAILED:                 { bg: '#fee2e2', color: '#991b1b', label: 'Failed'            },
  MANUAL_REVIEW_REQUIRED: { bg: '#fce7f7', color: '#9d174d', label: 'Manual Review'    },
  UPLOADING:              { bg: '#f1f5f9', color: '#475569', label: 'Uploading'        },
};

export default React.memo(function StatusBadge({ status, size = 'sm' }) {
  const s = STYLES[status] || STYLES.unknown;
  const padding = size === 'lg' ? '4px 12px' : '2px 8px';
  const fontSize = size === 'lg' ? '12px' : '11px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding, borderRadius: '20px', fontSize, fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
});
