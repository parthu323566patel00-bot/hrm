/**
 * constants/index.js
 * ------------------
 * Application-wide constants shared across components and services.
 */

export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

/**
 * Clinical roles available for invitation assignment.
 * IDs match the seeded roles in main.py.
 */
export const CLINICAL_ROLES = [
  { id: 3,  name: 'Receptionist'     },
  { id: 4,  name: 'Doctor'           },
  { id: 5,  name: 'Nurse'            },
  { id: 6,  name: 'Lab Technician'   },
  { id: 7,  name: 'Radiologist'      },
  { id: 8,  name: 'Pharmacist'       },
  { id: 9,  name: 'Billing Clerk'    },
  { id: 10, name: 'Inventory Manager'},
];
