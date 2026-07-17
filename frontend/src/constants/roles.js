/**
 * src/constants/roles.js
 * -----------------------
 * Single source of truth for role IDs on the frontend.
 *
 * These values MUST match the seeded role IDs in the database:
 *   1  = Super Admin
 *   2  = Hospital Admin
 *   3  = Receptionist
 *   4  = Doctor
 *   5  = Nurse
 *   6  = Lab Technician
 *   7  = Radiologist
 *   8  = Pharmacist
 *   9  = Billing Clerk
 *   10 = Inventory Manager
 *
 * DO NOT change these values.
 */

export const ROLES = {
  SUPER_ADMIN:       1,
  HOSPITAL_ADMIN:    2,
  RECEPTIONIST:      3,
  DOCTOR:            4,
  NURSE:             5,
  LAB_TECHNICIAN:    6,
  RADIOLOGIST:       7,
  PHARMACIST:        8,
  BILLING_CLERK:     9,
  INVENTORY_MANAGER: 10,
};

/**
 * Human-readable label for each role ID.
 * Used in headers, profile panels, and welcome banners.
 */
export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]:       'Super Admin',
  [ROLES.HOSPITAL_ADMIN]:    'Hospital Admin',
  [ROLES.RECEPTIONIST]:      'Receptionist',
  [ROLES.DOCTOR]:            'Doctor',
  [ROLES.NURSE]:             'Nurse',
  [ROLES.LAB_TECHNICIAN]:    'Lab Technician',
  [ROLES.RADIOLOGIST]:       'Radiologist',
  [ROLES.PHARMACIST]:        'Pharmacist',
  [ROLES.BILLING_CLERK]:     'Billing Clerk',
  [ROLES.INVENTORY_MANAGER]: 'Inventory Manager',
};
