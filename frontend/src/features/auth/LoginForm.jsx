/**
 * features/auth/LoginForm.jsx
 * ----------------------------
 * Email + password login form.
 * Reads publicKey and calls login() from AuthContext.
 */

import React, { useState } from 'react';
import { Mail, ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Alert from '../../components/ui/Alert';
import InputField from '../../components/ui/InputField';
import PasswordField from '../../components/ui/PasswordField';
import SubmitButton from '../../components/ui/SubmitButton';
import CryptoPanel from './CryptoPanel';

export default function LoginForm() {
  const { login, encryptPassword, errorMsg, successMsg, loading } = useAuth();

  const [email, setEmail]                       = useState('');
  const [password, setPassword]                 = useState('');
  const [encryptedPayload, setEncryptedPayload] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEncryptedPayload('');

    // Validate inputs
    if (!email || !password) {
      return; // Form validation will handle this
    }

    // Encrypt password for display and confirm cryptographic setup.
    try {
      const ciphertext = encryptPassword(password);
      setEncryptedPayload(ciphertext);
      // Only proceed to login if encryption succeeded. AuthContext.login will encrypt once.
      await login(email, password);
      setPassword('');
    } catch (err) {
      // Encryption failed - error is already set in context by encryptPassword or login
      console.error('Login failed:', err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Alert type="error"   message={errorMsg}   />
      <Alert type="success" message={successMsg} />

      <InputField
        label="Email Address"
        id="login-email"
        type="email"
        icon={Mail}
        placeholder="admin@medicore.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />

      <PasswordField
        label="Password"
        id="login-password"
        placeholder="••••••••••••••"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />

      <SubmitButton loading={loading} loadingText="Processing secure authentication...">
        Sign In <ChevronRight size={18} />
      </SubmitButton>

      <CryptoPanel payload={encryptedPayload} />
    </form>
  );
}
