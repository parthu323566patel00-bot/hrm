/**
 * context/AuthContext.jsx
 * ------------------------
 * Single source of truth for authentication state across the entire app.
 *
 * Provides:
 *  - token / userProfile / publicKey
 *  - Global error + success messages
 *  - login(), logout() actions
 *  - Automatic session restoration from localStorage on mount
 */

import React, { createContext, useState, useEffect, useCallback } from 'react';
import JSEncrypt from 'jsencrypt';
import { fetchPublicKey, login as apiLogin } from '../services/authService';
import { fetchUserProfile, updateUserProfile } from '../services/userService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken]             = useState(() => localStorage.getItem('token') || '');
  const [userProfile, setUserProfile] = useState(null);
  const [publicKey, setPublicKey]     = useState('');
  const [errorMsg, setErrorMsg]       = useState('');
  const [successMsg, setSuccessMsg]   = useState('');
  const [loading, setLoading]         = useState(false);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const clearMessages = useCallback(() => {
    setErrorMsg('');
    setSuccessMsg('');
  }, []);

  // -------------------------------------------------------------------------
  // Load public key once on mount (with retry built into authService)
  // -------------------------------------------------------------------------
  const loadPublicKey = useCallback(async () => {
    try {
      const pem = await fetchPublicKey(3);
      setPublicKey(pem);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Restore session from localStorage
  // -------------------------------------------------------------------------
  const restoreSession = useCallback(async (savedToken) => {
    try {
      const profile = await fetchUserProfile(savedToken);
      setUserProfile(profile);
    } catch {
      // Token expired or invalid — clear it
      localStorage.removeItem('token');
      setToken('');
      setUserProfile(null);
    }
  }, []);

  // On mount: fetch public key + restore session if token exists
  useEffect(() => {
    loadPublicKey();
    if (token) {
      restoreSession(token);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // encrypt a plaintext password with the loaded RSA public key
  // -------------------------------------------------------------------------
  const encryptPassword = useCallback((plaintext) => {
    if (!publicKey) throw new Error('Cryptographic setup not ready. Public key not found.');
    const encryptor = new JSEncrypt();
    encryptor.setPublicKey(publicKey);
    const encrypted = encryptor.encrypt(plaintext);
    if (!encrypted) throw new Error('Password encryption failed.');
    return encrypted;
  }, [publicKey]);

  // -------------------------------------------------------------------------
  // Login action
  // -------------------------------------------------------------------------
  const login = useCallback(async (email, password) => {
    clearMessages();
    setLoading(true);
    try {
      const encryptedPassword = encryptPassword(password);
      const data = await apiLogin(email, encryptedPassword);

      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);

      const profile = await fetchUserProfile(data.access_token);
      setUserProfile(profile);
      setSuccessMsg('Welcome Back! Redirecting...');
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }, [encryptPassword, clearMessages]);

  // -------------------------------------------------------------------------
  // Update Profile action
  // -------------------------------------------------------------------------
  const updateProfile = useCallback(async (updateData) => {
    if (!token) return;
    setLoading(true);
    try {
      const updatedProfile = await updateUserProfile(token, updateData);
      setUserProfile(updatedProfile);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => clearMessages(), 3000);
      return updatedProfile;
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, clearMessages]);

  // -------------------------------------------------------------------------
  // Logout action
  // -------------------------------------------------------------------------
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken('');
    setUserProfile(null);
    clearMessages();
  }, [clearMessages]);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value = {
    token,
    userProfile,
    publicKey,
    errorMsg,
    successMsg,
    loading,
    login,
    logout,
    updateProfile,
    encryptPassword,
    clearMessages,
    setErrorMsg,
    setSuccessMsg,
    loadPublicKey,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
