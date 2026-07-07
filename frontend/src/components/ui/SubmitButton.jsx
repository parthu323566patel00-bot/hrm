/**
 * components/ui/SubmitButton.jsx
 * --------------------------------
 * Full-width animated submit button with loading state.
 *
 * Props:
 *   loading      - boolean — shows spinner text when true
 *   loadingText  - string to show while loading
 *   children     - default button content
 *   ...rest      - forwarded to <button>
 */

import React from 'react';

export default function SubmitButton({ loading, loadingText = 'Processing...', children, ...rest }) {
  return (
    <button type="submit" className="submit-btn" disabled={loading} {...rest}>
      {loading ? loadingText : children}
    </button>
  );
}
