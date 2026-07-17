/**
 * constants/index.js
 * ------------------
 * Application-wide constants shared across components and services.
 */

export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

/**
 * Clinical roles available for invitation assignment.
 * IDs match the actual seeded roles in the database.
 * Super Admin (id=1) is excluded — created only via seeder.
 *
 * DB role mapping:
 *   1 = Super Admin      (excluded)
 *   2 = Hospital Admin
 *   3 = Receptionist
 *   4 = Doctor
 *   5 = Nurse
 *   6 = Lab Technician
 *   7 = Radiologist
 *   8 = Pharmacist
 *   9 = Billing Clerk
 *  10 = Inventory Manager
 */
export const CLINICAL_ROLES = [
  { id:  2, name: 'Hospital Admin'    },
  { id:  3, name: 'Receptionist'      },
  { id:  4, name: 'Doctor'            },
  { id:  5, name: 'Nurse'             },
  { id:  6, name: 'Lab Technician'    },
  { id:  7, name: 'Radiologist'       },
  { id:  8, name: 'Pharmacist'        },
  { id:  9, name: 'Billing Clerk'     },
  { id: 10, name: 'Inventory Manager' },
];
