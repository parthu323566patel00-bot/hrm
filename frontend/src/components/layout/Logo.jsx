/**
 * components/layout/Logo.jsx
 * ---------------------------
 * MediCore HMS brand logo — HeartPulse icon + text.
 *
 * Props:
 *   size   - Icon size (default 32)
 *   badge  - Optional badge text rendered next to the logo
 */

import React from 'react';
import { HeartPulse } from 'lucide-react';

export default function Logo({ size = 32, badge }) {
  return (
    <div className="logo-container">
      <HeartPulse className="logo-icon" size={size} />
      <span className="logo-text">MediCore HMS</span>
      {badge && <span className="badge-hms">{badge}</span>}
    </div>
  );
}
