/**
 * App.jsx
 * --------
 * Application root.
 *
 * Responsibilities:
 *  1. Wrap the entire tree in <AuthProvider> (token, user, publicKey, crypto)
 *  2. Set up React Router
 *  3. Route logic:
 *     - ?token= query param → InviteRegisterPage (invite activation)
 *     - Authenticated        → DashboardPage
 *     - Unauthenticated      → LoginPage
 *
 * No state management, no API calls — purely routing composition.
 */

import React, { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { validateInviteToken } from './services/authService';
import { ROLES } from './constants/roles';
import LoginPage from './pages/LoginPage';
import InviteRegisterPage from './pages/InviteRegisterPage';
import DashboardPage from './pages/DashboardPage';
import ReceptionistPage from './pages/ReceptionistPage';
import DoctorPage from './pages/DoctorPage';
import NursePage from './pages/NursePage';
import PharmacyPage from './pages/PharmacyPage';
import LaboratoryPage from './pages/LaboratoryPage';
import RadiologyPage from './pages/RadiologyPage';
import BillingPage from './pages/BillingPage';
import InventoryPage from './pages/InventoryPage';


// ─── Protected route wrapper ─────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { token, userProfile } = useAuth();
  if (!token || !userProfile) return <Navigate to="/" replace />;
  return children;
}

function InventoryManagerRoute({ children }) {
  const { userProfile } = useAuth();
  if (!userProfile || userProfile.role_id !== ROLES.INVENTORY_MANAGER) return <Navigate to="/dashboard" replace />;
  return children;
}

// ─── Public route wrapper (redirect to correct page if already logged in) ─────
function PublicRoute({ children }) {
  const { token, userProfile } = useAuth();
  if (token && userProfile) {
    if (userProfile.role_id === ROLES.INVENTORY_MANAGER) return <Navigate to="/inventory" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ─── Invite handler — detects ?token= on mount ───────────────────────────────
function InviteHandler() {
  const location = useLocation();
  const navigate  = useNavigate();

  const [inviteToken, setInviteToken]         = useState('');
  const [inviteMetadata, setInviteMetadata]   = useState(null);
  const [inviteValidating, setInviteValidating] = useState(false);

  useEffect(() => {
    const urlToken = new URLSearchParams(location.search).get('token');
    if (urlToken) {
      setInviteToken(urlToken);
      (async () => {
        setInviteValidating(true);
        try {
          const metadata = await validateInviteToken(urlToken);
          setInviteMetadata(metadata);
        } catch (err) {
          console.error('Invite validation failed:', err.message);
          setInviteToken('');
          window.history.replaceState({}, document.title, '/');
        } finally {
          setInviteValidating(false);
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearInvite = () => {
    setInviteToken('');
    setInviteMetadata(null);
    window.history.replaceState({}, document.title, '/');
    navigate('/', { replace: true });
  };

  // Loading spinner while validating
  if (inviteValidating) {
    return (
      <div className="auth-wrapper">
        <div
          className="app-container"
          style={{ gridTemplateColumns: '1fr', minHeight: '300px', width: '400px' }}
        >
          <div className="form-section" style={{ textAlign: 'center' }}>
            <h2>Verifying Invitation...</h2>
            <p style={{ marginTop: '12px' }}>
              Please wait while we establish secure transport tokens.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Invite activation form
  if (inviteToken && inviteMetadata) {
    return (
      <InviteRegisterPage
        inviteToken={inviteToken}
        inviteMetadata={inviteMetadata}
        onCancel={clearInvite}
        onSuccess={clearInvite}
      />
    );
  }

  // No invite — render regular login
  return (
    <PublicRoute>
      <LoginPage />
    </PublicRoute>
  );
}

// ─── Inner router (must be inside BrowserRouter to use hooks) ─────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Root: handles both normal login and ?token= invite links */}
      <Route path="/" element={<InviteHandler />} />

      {/* Protected dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Receptionist desk */}
      <Route
        path="/receptionist"
        element={
          <ProtectedRoute>
            <ReceptionistPage />
          </ProtectedRoute>
        }
      />

      {/* Doctor console */}
      <Route
        path="/doctor"
        element={
          <ProtectedRoute>
            <DoctorPage />
          </ProtectedRoute>
        }
      />

      {/* Nurse station */}
      <Route path="/nurse" element={<ProtectedRoute><NursePage /></ProtectedRoute>} />

      {/* Role-specific worklist pages */}
      <Route path="/pharmacy"   element={<ProtectedRoute><PharmacyPage /></ProtectedRoute>} />
      <Route path="/laboratory" element={<ProtectedRoute><LaboratoryPage /></ProtectedRoute>} />
      <Route path="/radiology"  element={<ProtectedRoute><RadiologyPage /></ProtectedRoute>} />
      <Route path="/billing"    element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
      <Route path="/inventory" element={
        <ProtectedRoute>
          <InventoryManagerRoute>
            <InventoryPage />
          </InventoryManagerRoute>
        </ProtectedRoute>
      } />

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
