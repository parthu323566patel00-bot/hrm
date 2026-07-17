import React from 'react';
import { Scan } from 'lucide-react';
import WorklistPage from './WorklistPage';
import { getRadiologyOrders } from '../services/visitService';

const STATUS_STYLE = {
  VISIBLE_TO_RADIOLOGY: { bg: '#dbeafe', color: '#1e40af', label: 'Awaiting Imaging' },
  IN_PROGRESS:          { bg: '#fef3c7', color: '#92400e', label: 'In Progress' },
  COMPLETED:            { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
};

const COLUMNS = [
  { key: 'patient_name', label: 'Patient' },
  { key: 'imaging_type', label: 'Imaging Type', render: (v) =>
    <span style={{ fontWeight: 700, color: '#0f172a' }}>{v}</span> },
  { key: 'body_region',  label: 'Body Region' },
  { key: 'clinical_indication', label: 'Clinical Indication', render: (v) =>
    <span style={{ color: '#64748b' }}>{v}</span> },
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

export default function RadiologyPage() {
  return (
    <WorklistPage
      title="Radiology Worklist"
      Icon={Scan}
      fetchFn={getRadiologyOrders}
      columns={COLUMNS}
      emptyMsg="No radiology orders pending."
      bannerSubtitle="Radiology orders ready for imaging — "
    />
  );
}
