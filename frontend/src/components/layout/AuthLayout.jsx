/**
 * components/layout/AuthLayout.jsx
 * ----------------------------------
 * Two-column auth page shell:
 *   Left  — hero branding panel (heroContent prop)
 *   Right — form panel (children)
 *
 * Props:
 *   heroContent - JSX rendered inside the left hero section
 *   children    - JSX rendered inside the right form section
 */

import React from 'react';
import BackgroundBlobs from './BackgroundBlobs';

export default function AuthLayout({ heroContent, children }) {
  return (
    <div className="auth-wrapper">
      <BackgroundBlobs />
      <div className="app-container">
        {/* Left: hero branding */}
        <div className="hero-section">
          {heroContent}
        </div>

        {/* Right: form content */}
        <div className="form-section">
          {children}
        </div>
      </div>
    </div>
  );
}
