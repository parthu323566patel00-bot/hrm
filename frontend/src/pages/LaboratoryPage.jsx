import React from 'react';
import { FlaskConical } from 'lucide-react';
import WorklistPage from './WorklistPage';
import { getLaboratoryOrders } from '../services/visitService';

const STATUS_STYLE = {
  VISIBLE_TO_LAB: { bg: '#dbeafe', color: '#1e40af', label: 'Awaiting Processing' },
  IN_PROGRESS:    { bg: '#fef3c7', color: '#92400e', label: 'In Progress' },
  COMPLETED:      { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
};

const COLUMNS = [
  { key: 'patient_name', label: 'Patient' },
  { key: 'test_name', label: 'Test', render: (v) =>
    <span style={{ fontWeight: 700, color: '#0f172a' }}>{v}</span> },
  { key: 'clinical_notes', label: 'Clinical Notes', render: (v) =>
    <span style={{ color: '#64748b', fontStyle: 'italic' }}>{v || '—'}</span> },
  { key: 'status', label: 'Status', render: (v) => {
    const s = STATUS_STYLE[v] || { bg: '#f1f5f9', color: '#334155', label: v };
    return (
      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px',
        borderRadius: '20px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
        {s.label}
      </span>
    );
  }},
  { key: 'ordered_at', label: 'Ordered' },
];

export default function LaboratoryPage() {
  return (
    <WorklistPage
      title="Laboratory Worklist"
      Icon={FlaskConical}
      fetchFn={getLaboratoryOrders}
      columns={COLUMNS}
      emptyMsg="No lab orders pending."
      bannerSubtitle="Lab orders ready for processing — "
    />
  );
}
