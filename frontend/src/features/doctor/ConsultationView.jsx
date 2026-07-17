/**
 * features/doctor/ConsultationView.jsx
 * ---------------------------------------
 * Tabbed workspace inside an active consultation.
 * Tabs: Vitals | Notes | Diagnosis | Rx | Lab | Radiology | Files
 */

import React from 'react';
import { Activity, FileText, Stethoscope, Pill, FlaskConical, Scan, Paperclip } from 'lucide-react';
import VitalsForm from './VitalsForm';
import ClinicalNotesForm from './ClinicalNotesForm';
import DiagnosisForm from './DiagnosisForm';
import PrescriptionForm from './PrescriptionForm';
import LabOrderForm from './LabOrderForm';
import RadiologyOrderForm from './RadiologyOrderForm';
import AttachmentsView from './AttachmentsView';
import PatientDocumentsPanel from '../documents/PatientDocumentsPanel';

const TABS = [
  { key: 'vitals',     label: 'Vitals',       Icon: Activity     },
  { key: 'notes',      label: 'Notes',        Icon: FileText     },
  { key: 'diagnosis',  label: 'Diagnosis',    Icon: Stethoscope  },
  { key: 'rx',         label: 'Prescriptions',Icon: Pill         },
  { key: 'lab',        label: 'Lab Orders',   Icon: FlaskConical },
  { key: 'radiology',  label: 'Radiology',    Icon: Scan         },
  { key: 'files',      label: 'Attachments',  Icon: Paperclip    },
  { key: 'documents',  label: 'Documents',    Icon: FileText     },
];

export default function ConsultationView({ visit, token, activeTab, onTabChange, onDataSaved }) {
  const isActive = visit.status === 'IN_PROGRESS';
  const isDone   = visit.status === 'COMPLETED';

  const renderTab = () => {
    const props = { visit, token, onSaved: onDataSaved, readOnly: isDone };
    switch (activeTab) {
      case 'vitals':    return <VitalsForm        {...props} />;
      case 'notes':     return <ClinicalNotesForm {...props} />;
      case 'diagnosis': return <DiagnosisForm     {...props} />;
      case 'rx':        return <PrescriptionForm  {...props} />;
      case 'lab':       return <LabOrderForm       {...props} />;
      case 'radiology': return <RadiologyOrderForm {...props} />;
      case 'files':     return <AttachmentsView    {...props} />;
      case 'documents': return (
        <PatientDocumentsPanel
          token={token}
          patientId={visit.patient_id}
          visitId={visit.id}
        />
      );
      default: return null;
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #f1f5f9',
        padding: '0 16px', flexShrink: 0, background: '#fff',
        overflowX: 'auto',
      }}>
        {TABS.map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <button key={key} onClick={() => onTabChange(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '11px 14px', borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                color: active ? 'var(--color-primary)' : '#64748b',
                fontSize: '12px', fontWeight: active ? 700 : 600,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>

      {/* Immutable banner */}
      {isDone && (
        <div style={{
          padding: '8px 20px', background: '#ecfdf5',
          borderBottom: '1px solid #a7f3d0', flexShrink: 0,
          fontSize: '12px', color: '#065f46', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          🔒 This consultation is completed. Medical record is read-only.
        </div>
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {renderTab()}
      </div>
    </div>
  );
}
