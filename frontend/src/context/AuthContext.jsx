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
  // Load public key — cached in sessionStorage for the session lifetime.
  // -------------------------------------------------------------------------
  // Load public key.
  // Always fetches from server and compares against sessionStorage.
  // If the server key changed (e.g. backend restart), the cache is busted.
  // -------------------------------------------------------------------------
  const loadPublicKey = useCallback(async () => {
    try {
      const freshPem = await fetchPublicKey(3);
      const cached   = sessionStorage.getItem('__pk');

      // If server key differs from cached key, bust the cache
      if (cached && cached !== freshPem) {
        sessionStorage.removeItem('__pk');
      }

      sessionStorage.setItem('__pk', freshPem);
      setPublicKey(freshPem);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Restore session from localStorage — uses sessionStorage profile cache
  // to avoid a network call on every page refresh.
  // -------------------------------------------------------------------------
  const restoreSession = useCallback(async (savedToken) => {
    try {
      const cached = sessionStorage.getItem('__profile');
      if (cached) {
        setUserProfile(JSON.parse(cached));
        return;
      }
      const profile = await fetchUserProfile(savedToken);
      sessionStorage.setItem('__profile', JSON.stringify(profile));
      setUserProfile(profile);
    } catch {
      // Token expired or invalid — clear everything
      localStorage.removeItem('token');
      sessionStorage.removeItem('__profile');
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
    if (!publicKey) {
      throw new Error('Cryptographic setup not ready. Public key not found. Try refreshing the page.');
    }
    try {
      const encryptor = new JSEncrypt();
      if (!encryptor) {
        throw new Error('Encryption library not available. Please refresh the page.');
      }
      encryptor.setPublicKey(publicKey);
      const encrypted = encryptor.encrypt(plaintext);
      if (!encrypted || encrypted === false) {
        throw new Error('Password encryption failed. The key may be invalid.');
      }
      return encrypted;
    } catch (err) {
      throw new Error(`Encryption error: ${err.message}`);
    }
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
      sessionStorage.setItem('__profile', JSON.stringify(profile));
      setUserProfile(profile);
      setSuccessMsg('Welcome Back! Redirecting...');
    } catch (err) {
      // Bust cached public key on auth failure — server may have rotated it
      sessionStorage.removeItem('__pk');
      setPublicKey('');
      loadPublicKey();
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }, [encryptPassword, clearMessages, loadPublicKey]);

  // -------------------------------------------------------------------------
  // Update Profile action
  // -------------------------------------------------------------------------
  const updateProfile = useCallback(async (updateData) => {
    if (!token) return;
    setLoading(true);
    try {
      const updatedProfile = await updateUserProfile(token, updateData);
      sessionStorage.setItem('__profile', JSON.stringify(updatedProfile));
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
    sessionStorage.removeItem('__profile');
    sessionStorage.removeItem('__pk');
    setToken('');
    setUserProfile(null);
    setPublicKey('');
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
