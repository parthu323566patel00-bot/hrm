import React from 'react';
import { Pill } from 'lucide-react';
import WorklistPage from './WorklistPage';
import { getPharmacyPrescriptions } from '../services/visitService';

const STATUS_STYLE = {
  AVAILABLE_TO_PHARMACY: { bg: '#d1fae5', color: '#065f46', label: 'Ready to Dispense' },
  DISPENSED:             { bg: '#dbeafe', color: '#1e40af', label: 'Dispensed' },
};

const COLUMNS = [
  { key: 'patient_name', label: 'Patient' },
  { key: 'medication_name', label: 'Medication', render: (v) =>
    <span style={{ fontWeight: 700, color: '#0f172a' }}>{v}</span> },
  { key: 'dosage',     label: 'Dosage' },
  { key: 'frequency',  label: 'Frequency' },
  { key: 'duration',   label: 'Duration' },
  { key: 'route',      label: 'Route' },
  { key: 'instructions', label: 'Instructions', render: (v) =>
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
  { key: 'prescribed_at', label: 'Prescribed' },
];

export default function PharmacyPage() {
  return (
    <WorklistPage
      title="Pharmacy Worklist"
      Icon={Pill}
      fetchFn={getPharmacyPrescriptions}
      columns={COLUMNS}
      emptyMsg="No prescriptions ready for dispensing."
      bannerSubtitle="Prescriptions available for dispensing — "
    />
  );
}
