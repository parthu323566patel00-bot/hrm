/**
 * pages/InviteRegisterPage.jsx
 * -----------------------------
 * Account activation page for users who arrived via an invitation link.
 *
 * Props:
 *   inviteToken    - The raw token from the URL
 *   inviteMetadata - Validated metadata from the backend
 *   onCancel       - Called when the user cancels (returns to login)
 *   onSuccess      - Called after successful registration
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout';
import Logo from '../components/layout/Logo';
import InviteRegisterForm from '../features/auth/InviteRegisterForm';

function InviteHero({ inviteMetadata }) {
  return (
    <>
      <Logo size={32} />

      <div className="hero-content">
        <h1>
          Complete Your<br />
          <span>MediCore Account.</span>
        </h1>
        <p>
          You have been securely invited to join the clinical network.
          Please enter a secure password to finalize your system credentials.
          Your email and clinic parameters are locked to preserve organization isolation.
        </p>

        <div className="features-grid" style={{ marginTop: '30px' }}>
          <div className="feature-card">
            <h3><ShieldCheck size={16} /> Locked Role</h3>
            <p>Role initialized as: <strong>{inviteMetadata.role_name}</strong></p>
          </div>
          <div className="feature-card">
            <h3><ShieldCheck size={16} /> SaaS Isolation</h3>
            <p>Assigned Hospital ID: <strong>{inviteMetadata.tenant_id}</strong></p>
          </div>
        </div>
      </div>

      <div className="hero-footer">
        <span /> Cryptotransport Verified
      </div>
    </>
  );
}

export default function InviteRegisterPage({ inviteToken, inviteMetadata, onCancel, onSuccess }) {
  return (
    <AuthLayout heroContent={<InviteHero inviteMetadata={inviteMetadata} />}>
      <div className="form-header">
        <h2>Activate Account</h2>
        <p>Configure credentials for <strong>{inviteMetadata.email}</strong></p>
      </div>
      <InviteRegisterForm
        inviteMetadata={inviteMetadata}
        inviteToken={inviteToken}
        onCancel={onCancel}
        onSuccess={onSuccess}
      />
    </AuthLayout>
  );
}
