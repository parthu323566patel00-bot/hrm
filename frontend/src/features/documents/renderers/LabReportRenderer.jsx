import React from 'react';
import PatientCard from '../components/PatientCard';
import ProviderCard from '../components/ProviderCard';
import TestResultsTable from '../components/TestResultsTable';
import MetadataPanel from '../components/MetadataPanel';

export default React.memo(function LabReportRenderer({ data, docMeta }) {
  const { patient, provider, encounter, tests = [], remarks, observations = [], parser_metadata } = data;
  const abnormal = tests.filter(t => ['high','low','critical','borderline'].includes(t.status));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{
        padding: '16px 20px', borderRadius: '14px',
        background: 'linear-gradient(135deg,#0f172a,#1e293b)',
        color: '#fff',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Laboratory Report</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: '#cbd5e1' }}>
          {encounter?.report_date && <span>Report Date: {encounter.report_date}</span>}
          {encounter?.report_number && <span>Report No: {encounter.report_number}</span>}
          {encounter?.accession && <span>Accession: {encounter.accession}</span>}
        </div>
      </div>

      {/* Patient + Provider */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <PatientCard patient={patient} />
        <ProviderCard provider={provider} />
      </div>

      {/* Clinical Insights */}
      {(abnormal.length > 0 || observations.length > 0) && (
        <div style={{
          padding: '14px 16px', borderRadius: '12px',
          background: '#fff7ed', border: '1px solid #fed7aa',
        }}>
          <p style={{ fontWeight: 700, fontSize: '13px', color: '#c2410c', marginBottom: '8px' }}>
            Clinical Insights
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#9a3412' }}>
            <span>Total Tests: <strong>{tests.length}</strong></span>
            <span>Abnormal: <strong style={{ color: '#dc2626' }}>{abnormal.length}</strong></span>
            <span>Normal: <strong style={{ color: '#16a34a' }}>{tests.length - abnormal.length}</strong></span>
          </div>
        </div>
      )}

      {/* Test Results */}
      <div>
        <p style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '12px' }}>
          Test Results
        </p>
        <TestResultsTable tests={tests} />
      </div>

      {/* Remarks */}
      {remarks && (
        <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f0f9ff', border: '1px solid #bae6fd' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', color: '#0369a1', marginBottom: '6px' }}>Remarks / Interpretation</p>
          <p style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.6 }}>{remarks}</p>
        </div>
      )}

      {/* Metadata */}
      <MetadataPanel meta={parser_metadata} docMeta={docMeta} />
    </div>
  );
});
