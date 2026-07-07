/**
 * pages/LoginPage.jsx
 * --------------------
 * The sign-in page — two-column auth layout with the login form on the right
 * and brand hero on the left.
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout';
import Logo from '../components/layout/Logo';
import LoginForm from '../features/auth/LoginForm';

function LoginHero() {
  return (
    <>
      <Logo size={32} />

      <div className="hero-content">
        <h1>
          Advanced Care,<br />
          <span>Perfected Security.</span>
        </h1>
        <p>
          MediCore is an enterprise-grade Hospital Management System that guarantees
          complete patient data confidentiality. Our end-to-end transport encryption
          secures user credentials at the client level before dispatching them to the
          central node.
        </p>

        <div className="features-grid">
          <div className="feature-card">
            <h3><ShieldCheck size={16} /> RSA Encrypted</h3>
            <p>All passwords are encrypted with RSA-2048 in the browser before hitting the network.</p>
          </div>
          <div className="feature-card">
            <h3><ShieldCheck size={16} /> Access Control</h3>
            <p>Protected authorization layers for clinical and admin services.</p>
          </div>
        </div>
      </div>

      <div className="hero-footer">
        <span /> Live Security Pipeline Active
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout heroContent={<LoginHero />}>
      <div className="form-header">
        <h2>Welcome Back</h2>
        <p>Sign in to access your portal</p>
      </div>
      <LoginForm />
    </AuthLayout>
  );
}
