import React from 'react';
import { Receipt } from 'lucide-react';
import WorklistPage from './WorklistPage';
import { getBillingItems } from '../services/visitService';

const STATUS_STYLE = {
  PENDING:  { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  INVOICED: { bg: '#dbeafe', color: '#1e40af', label: 'Invoiced' },
  PAID:     { bg: '#d1fae5', color: '#065f46', label: 'Paid' },
};

const COLUMNS = [
  { key: 'patient_name', label: 'Patient' },
  { key: 'description',  label: 'Description', render: (v) =>
    <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span> },
  { key: 'amount', label: 'Amount', render: (v, row) =>
    <span style={{ fontWeight: 700, color: '#0f172a' }}>
      {row.currency} {Number(v).toFixed(2)}
    </span> },
  { key: 'status', label: 'Status', render: (v) => {
    const s = STATUS_STYLE[v] || { bg: '#f1f5f9', color: '#334155', label: v };
    return (
      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px',
        borderRadius: '20px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
        {s.label}
      </span>
    );
  }},
  { key: 'created_at', label: 'Created' },
];

export default function BillingPage() {
  return (
    <WorklistPage
      title="Billing Worklist"
      Icon={Receipt}
      fetchFn={getBillingItems}
      columns={COLUMNS}
      emptyMsg="No billing items found."
      bannerSubtitle="Consultation charges and billing items — "
    />
  );
}
