/**
 * features/dashboard/StatsGrid.jsx
 * ----------------------------------
 * Four summary stat cards displayed at the top of the dashboard.
 */

import React from 'react';
import { Users, Calendar, Activity, PlusCircle } from 'lucide-react';

const STATS = [
  {
    icon:    Users,
    color:   'pulse-teal',
    label:   'Active Patients',
    value:   '148',
    change:  '+4 newly admitted',
    changeClass: 'text-green',
  },
  {
    icon:    Calendar,
    color:   'pulse-blue',
    label:   'Appointments',
    value:   '12',
    change:  'Scheduled for today',
    changeClass: 'text-blue',
  },
  {
    icon:    Activity,
    color:   'pulse-red',
    label:   'ICU Bed Capacity',
    value:   '85%',
    change:  '3 critical beds remaining',
    changeClass: 'text-red',
  },
  {
    icon:    PlusCircle,
    color:   'pulse-gold',
    label:   'Staff on Duty',
    value:   '8',
    change:  'Emergency team ready',
    changeClass: 'text-green',
  },
];

export default function StatsGrid() {
  return (
    <div className="stats-grid">
      {STATS.map(({ icon: Icon, color, label, value, change, changeClass }) => (
        <div className="stat-card" key={label}>
          <div className={`stat-icon ${color}`}>
            <Icon size={20} />
          </div>
          <div className="stat-info">
            <h3>{label}</h3>
            <p className="stat-number">{value}</p>
            <span className={`stat-change ${changeClass}`}>{change}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
