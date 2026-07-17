/**
 * features/documents/ClinicalRenderer.jsx
 * -----------------------------------------
 * Dynamic clinical document renderer.
 * Automatically selects the correct renderer based on document_type.
 * Adding a new document type only requires a new renderer — no changes here.
 *
 * Props:
 *   structuredJson - parsed JSON from document_content.structured_json
 *   rawText        - document_content.raw_text (for fallback)
 *   docMeta        - document metadata object (from GET /documents/{id})
 *   onDownload     - callback to download the original file
 */

import React, { Suspense, useMemo } from 'react';
import LabReportRenderer        from './renderers/LabReportRenderer';
import PrescriptionRenderer     from './renderers/PrescriptionRenderer';
import RadiologyRenderer        from './renderers/RadiologyRenderer';
import DischargeSummaryRenderer from './renderers/DischargeSummaryRenderer';
import UnknownRenderer          from './renderers/UnknownRenderer';

// Renderer registry — add new types here only
const RENDERERS = {
  lab_report:        LabReportRenderer,
  prescription:      PrescriptionRenderer,
  radiology:         RadiologyRenderer,
  discharge_summary: DischargeSummaryRenderer,
};

function LoadingShimmer() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: '48px', borderRadius: '10px', background: '#f1f5f9',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}

export default function ClinicalRenderer({ structuredJson, rawText, docMeta, onDownload }) {
  const { Renderer, data } = useMemo(() => {
    if (!structuredJson) {
      return { Renderer: UnknownRenderer, data: {} };
    }

    const docType = structuredJson.document_type || 'unknown';
    const R = RENDERERS[docType] || UnknownRenderer;
    return { Renderer: R, data: structuredJson };
  }, [structuredJson]);

  // Safety wrapper — never crash the app
  try {
    return (
      <Suspense fallback={<LoadingShimmer />}>
        <Renderer
          data={data}
          docMeta={docMeta}
          rawText={rawText}
          onDownload={onDownload}
        />
      </Suspense>
    );
  } catch (err) {
    return (
      <UnknownRenderer
        data={{}}
        docMeta={docMeta}
        rawText={rawText}
        onDownload={onDownload}
      />
    );
  }
}
