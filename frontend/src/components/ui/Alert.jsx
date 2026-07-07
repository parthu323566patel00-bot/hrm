/**
 * components/ui/Alert.jsx
 * -----------------------
 * Displays a success or error alert banner with an icon.
 *
 * Props:
 *   type    - 'error' | 'success'
 *   message - string to display
 */

import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function Alert({ type, message }) {
  if (!message) return null;

  const isError = type === 'error';
  return (
    <div className={`alert ${isError ? 'alert-error' : 'alert-success'}`}>
      {isError ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
      <span>{message}</span>
    </div>
  );
}
