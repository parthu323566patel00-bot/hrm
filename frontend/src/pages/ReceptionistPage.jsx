/**
 * pages/ReceptionistPage.jsx
 * ---------------------------
 * Dedicated dashboard for the Receptionist role (role_id = 3).
 * Provides patient registration and patient search/listing.
 */

import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import BackgroundBlobs from '../components/layout/BackgroundBlobs';
import DashboardHeader from '../components/layout/DashboardHeader';
import RegisterPatientForm from '../features/receptionist/RegisterPatientForm';
import PatientsList from '../features/receptionist/PatientsList';
import BookAppointmentModal from '../features/receptionist/BookAppointmentModal';
import TodaysAppointments from '../features/receptionist/TodaysAppointments';

export default function ReceptionistPage() {
  const { userProfile, token, logout } = useAuth();

  const [patientRefreshKey, setPatientRefreshKey]   = useState(0);
  const [apptRefreshKey, setApptRefreshKey]         = useState(0);
  const [showBookModal, setShowBookModal]           = useState(false);

  const handlePatientRegistered = () => setPatientRefreshKey(k => k + 1);

  const handleAppointmentBooked = () => {
    setShowBookModal(false);
    setApptRefreshKey(k => k + 1); // refresh today's list
  };

  return (
    <div className="root-wrapper">
      <BackgroundBlobs />

      <div className="dashboard-container">
        <DashboardHeader userProfile={userProfile} onLogout={logout} />

        <main className="dashboard-main">
          {/* Welcome bar */}
          <div className="welcome-banner" style={{ marginBottom: '24px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h2>Reception Desk</h2>
                <p>
                  Welcome, <strong>{userProfile?.full_name || 'Receptionist'}</strong> — register new patients or search existing records.
                </p>
              </div>
              <button
                onClick={() => setShowBookModal(true)}
                style={{
                  display:'flex', alignItems:'center', gap:'8px',
                  padding:'10px 20px', borderRadius:'12px',
                  background:'linear-gradient(135deg,#00acc1,#00838f)',
                  border:'none', color:'#fff',
                  fontSize:'13px', fontWeight:700, cursor:'pointer',
                  boxShadow:'0 4px 12px rgba(0,172,193,0.3)', flexShrink:0,
                }}
              >
                <Calendar size={16}/> Book Appointment
              </button>
            </div>
          </div>

          {/* Two-column layout: form left, list right (stacks on mobile) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.4fr',
            gap: '24px',
            alignItems: 'start',
          }}>
            {/* Left: Register form */}
            <RegisterPatientForm token={token} onSuccess={handlePatientRegistered} />

            {/* Right: Patients list with search */}
            <PatientsList token={token} refreshKey={patientRefreshKey} />
          </div>

          {/* Today's Appointments — full width below */}
          <TodaysAppointments token={token} refreshKey={apptRefreshKey} />
        </main>
      </div>

      {/* Book Appointment Modal */}
      {showBookModal && (
        <BookAppointmentModal
          token={token}
          onClose={() => setShowBookModal(false)}
          onBooked={handleAppointmentBooked}
        />
      )}
    </div>
  );
}
