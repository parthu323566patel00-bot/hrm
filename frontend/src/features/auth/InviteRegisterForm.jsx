/**
 * features/auth/InviteRegisterForm.jsx
 * --------------------------------------
 * Account activation form shown to users who followed an invitation link.
 *
 * Props:
 *   inviteMetadata  - { email, tenant_id, role_name } from the validated token
 *   inviteToken     - The raw token string
 *   onCancel        - Called when the user clicks "Cancel and return to Sign In"
 *   onSuccess       - Called after successful registration (e.g. redirect to login)
 */

import React, { useState } from 'react';
import { Mail, Briefcase, ChevronRight } from 'lucide-react';
import JSEncrypt from 'jsencrypt';
import { useAuth } from '../../hooks/useAuth';
import { registerInvitedUser } from '../../services/authService';
import Alert from '../../components/ui/Alert';
import InputField from '../../components/ui/InputField';
import PasswordField from '../../components/ui/PasswordField';
import SubmitButton from '../../components/ui/SubmitButton';
import CryptoPanel from './CryptoPanel';

export default function InviteRegisterForm({ inviteMetadata, inviteToken, onCancel, onSuccess }) {
  const { publicKey } = useAuth();

  const [password, setPassword]                 = useState('');
  const [errorMsg, setErrorMsg]                 = useState('');
  const [successMsg, setSuccessMsg]             = useState('');
  const [loading, setLoading]                   = useState(false);
  const [encryptedPayload, setEncryptedPayload] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    if (!publicKey) {
      setErrorMsg('Cryptographic setup not ready. Public key not found.');
      setLoading(false);
      return;
    }

    try {
      // Encrypt password client-side
      const encryptor = new JSEncrypt();
      encryptor.setPublicKey(publicKey);
      const encrypted = encryptor.encrypt(password);
      if (!encrypted) throw new Error('Password encryption failed.');
      setEncryptedPayload(encrypted);

      await registerInvitedUser(inviteToken, encrypted);
      setSuccessMsg('Account registered successfully! You can now log in.');
      setPassword('');

      // Clear the ?token= query param from the URL without a page reload
      window.history.replaceState({}, document.title, window.location.pathname);

      // Give the user 3 s to read the success message then hand off to parent
      setTimeout(() => onSuccess(), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Alert type="error"   message={errorMsg}   />
      <Alert type="success" message={successMsg} />

      <InputField
        label="Email (Read Only)"
        id="invite-email"
        type="text"
        icon={Mail}
        value={inviteMetadata.email}
        disabled
      />

      <InputField
        label="Hospital Tenant"
        id="invite-tenant"
        type="text"
        icon={Briefcase}
        value={inviteMetadata.tenant_id}
        disabled
      />

      <PasswordField
        label="System Password"
        id="invite-password"
        placeholder="Enter your new password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />

      <SubmitButton loading={loading} loadingText="Finalizing secure credentials...">
        Complete Activation <ChevronRight size={18} />
      </SubmitButton>

      <div className="toggle-form" style={{ marginTop: '20px' }}>
        <span onClick={onCancel} style={{ cursor: 'pointer' }}>
          Cancel and return to Sign In
        </span>
      </div>

      <CryptoPanel payload={encryptedPayload} title="RSA Encrypted Transport Payload" />
    </form>
  );
}
