/**
 * features/auth/CryptoPanel.jsx
 * ------------------------------
 * Debug panel that displays the RSA ciphertext after a login attempt.
 * Only visible when an encrypted payload exists (non-empty string).
 *
 * Props:
 *   payload - base64-encoded RSA ciphertext string
 *   title   - Optional panel title override
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function CryptoPanel({ payload, title = 'Client-Side RSA-2048 Ciphertext' }) {
  if (!payload) return null;

  return (
    <div className="crypto-panel">
      <div className="crypto-title">
        <ShieldCheck size={14} />
        {title}
      </div>
      <div className="crypto-data">{payload}</div>
    </div>
  );
}
