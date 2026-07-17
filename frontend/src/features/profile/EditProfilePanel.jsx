/**
 * features/profile/EditProfilePanel.jsx
 * ----------------------------------------
 * Slide-in drawer from the right for editing the current user's profile.
 * Fields: Full Name, Email, New Password (optional).
 * Password is RSA-encrypted before being sent (same flow as login).
 *
 * Props:
 *   onClose - called when the panel should be dismissed
 */

import React, { useState, useEffect } from 'react';
import {
  X, User, Mail, Lock, Save, Eye, EyeOff,
  CheckCircle, AlertCircle, Shield,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_LABELS } from '../../constants/roles';

export default function EditProfilePanel({ onClose }) {
  const { userProfile, updateProfile, encryptPassword } = useAuth();

  const [fullName, setFullName]       = useState(userProfile?.full_name || '');
  const [email, setEmail]             = useState(userProfile?.email || '');
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const [successMsg, setSuccessMsg]   = useState('');

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!fullName.trim()) return setErrorMsg('Full name is required.');
    if (!email.trim())    return setErrorMsg('Email is required.');

    if (password) {
      if (password.length < 6) return setErrorMsg('Password must be at least 6 characters.');
      if (password !== confirmPw) return setErrorMsg('Passwords do not match.');
    }

    setSaving(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
      };
      if (password) {
        payload.password = encryptPassword(password);
      }

      await updateProfile(payload);
      setSuccessMsg('Profile updated successfully.');
      setPassword('');
      setConfirmPw('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = userProfile?.is_superuser
    ? 'Super Admin'
    : ROLE_LABELS[userProfile?.role_id] || 'Staff';

  const inputStyle = {
    width: '100%',
    padding: '10px 12px 10px 38px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#0f172a',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(15,23,42,0.4)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0,
        width: '380px', height: '100vh',
        background: '#fff',
        borderLeft: '1px solid var(--color-border)',
        boxShadow: '-8px 0 32px rgba(15,23,42,0.12)',
        zIndex: 400,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.22s ease',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
            Edit Profile
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', padding: '4px',
            display: 'flex', alignItems: 'center',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Avatar + role badge */}
        <div style={{
          padding: '24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          borderBottom: '1px solid #f1f5f9', flexShrink: 0,
        }}>
          <div style={{
            width: 68, height: 68,
            background: 'var(--color-primary-light)',
            border: '2px solid rgba(0,172,193,0.2)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={30} color="var(--color-primary)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
              {userProfile?.full_name || '—'}
            </p>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 10px',
              borderRadius: '20px',
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              border: '1px solid rgba(0,172,193,0.2)',
            }}>
              {roleLabel}
            </span>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              {userProfile?.tenant_id}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} style={{
          flex: 1, overflowY: 'auto',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>

          {/* Status messages */}
          {errorMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#991b1b', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: '#ecfdf5', border: '1px solid #a7f3d0',
              color: '#065f46', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <CheckCircle size={15} /> {successMsg}
            </div>
          )}

          {/* Full Name */}
          <div>
            <label style={{
              display: 'block', fontSize: '11px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              color: '#64748b', marginBottom: '6px',
            }}>
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <User size={14} style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
              }} />
              <input
                type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setErrorMsg(''); setSuccessMsg(''); }}
                style={inputStyle}
                placeholder="Your full name"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{
              display: 'block', fontSize: '11px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              color: '#64748b', marginBottom: '6px',
            }}>
              Email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
              }} />
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrorMsg(''); setSuccessMsg(''); }}
                style={inputStyle}
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Shield size={13} color="var(--color-primary)" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                Change Password <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
              </span>
            </div>

            {/* New Password */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.5px',
                color: '#64748b', marginBottom: '6px',
              }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{
                  position: 'absolute', left: '12px', top: '50%',
                  transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
                }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrorMsg(''); setSuccessMsg(''); }}
                  style={{ ...inputStyle, paddingRight: '40px' }}
                  placeholder="Leave blank to keep current"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', display: 'flex', padding: '2px',
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            {password && (
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: '#64748b', marginBottom: '6px',
                }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
                  }} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setErrorMsg(''); setSuccessMsg(''); }}
                    style={{
                      ...inputStyle, paddingRight: '40px',
                      borderColor: confirmPw && confirmPw !== password ? '#fca5a5' : '#e2e8f0',
                    }}
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#94a3b8', display: 'flex', padding: '2px',
                    }}
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {confirmPw && confirmPw !== password && (
                  <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
                    Passwords don't match
                  </p>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex', gap: '10px',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: '10px',
              borderRadius: '10px', border: '1px solid #e2e8f0',
              background: '#f8fafc', color: '#475569',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '10px',
              borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, var(--color-primary), #00838f)',
              color: '#fff', fontSize: '13px', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
