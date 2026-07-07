/**
 * hooks/useAuth.js
 * ----------------
 * Convenience hook — consume AuthContext without importing the context object.
 *
 * Usage:
 *   const { token, login, logout, userProfile } = useAuth();
 */

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
