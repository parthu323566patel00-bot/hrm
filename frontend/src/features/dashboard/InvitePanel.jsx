/**
 * features/dashboard/InvitePanel.jsx
 * ------------------------------------
 * "Invite Staff Member" panel — visible only to users with invite permissions.
 * Uses the real /users/invite API endpoint.
 *
 * Department assignment is NOT part of the invitation.
 * Doctors select their own departments after registering.
 *
 * Props:
 *   token - JWT bearer token of the currently logged-in admin
 */

import React, { useState } from 'react';
import { PlusCircle, Mail, Send, Copy } from 'lucide-react';
import { createInvitation } from '../../services/userService';
import { CLINICAL_ROLES } from '../../constants';
import Alert from '../../components/ui/Alert';

export default function InvitePanel({ token }) {
  const [email, setEmail]               = useState('');
  const [roleId, setRoleId]             = useState(4); // Default: Doctor
  const [generatedLink, setGeneratedLink] = useState('');
  const [successMsg, setSuccessMsg]     = useState('');
  const [errorMsg, setErrorMsg]         = useState('');
  const [loading, setLoading]           = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setGeneratedLink('');
    setLoading(true);

    try {
      const data = await createInvitation(token, email, roleId);
      setGeneratedLink(data.invite_link);
      setSuccessMsg('Secure invitation link successfully generated!');
      setEmail('');
    } catch (err) {
      setErrorMsg(err.message || 'Error creating invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setSuccessMsg('Invitation link copied to clipboard!');
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <h3>
          <PlusCircle size={18} />
          Invite Staff Member
        </h3>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Alert type="error"   message={errorMsg}   />
        <Alert type="success" message={successMsg} />

        {/* Email */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Staff Email</label>
          <div className="input-wrapper">
            <input
              type="email"
              className="form-input"
              style={{ padding: '10px 10px 10px 38px' }}
              placeholder="colleague@hospital.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Mail className="input-icon" size={16} style={{ left: '12px' }} />
          </div>
        </div>

        {/* Role selector */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">System Role Assignment</label>
          <select
            className="form-input"
            style={{ padding: '10px 14px', background: '#f8fafc' }}
            value={roleId}
            onChange={e => setRoleId(parseInt(e.target.value))}
          >
            {CLINICAL_ROLES.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="submit-btn"
          style={{ padding: '10px' }}
          disabled={loading}
        >
          {loading ? 'Creating secure invitation...' : (
            <><Send size={16} /> Generate Invite Link</>
          )}
        </button>

        {/* Generated link display */}
        {generatedLink && (
          <div className="input-wrapper" style={{ marginTop: '10px' }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingRight: '48px', background: '#f1f5f9', fontSize: '12px', color: '#334155' }}
              value={generatedLink}
              readOnly
            />
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                cursor: 'pointer',
              }}
              title="Copy invite link"
            >
              <Copy size={16} />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
