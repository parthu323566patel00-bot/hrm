"""
app/core/constants/roles.py
----------------------------
Role ID constants for the MediCore HMS.

These constants are the single source of truth for role IDs.
They replace all hardcoded integer literals throughout the codebase.

DO NOT change these values — they must match the seeded role IDs in main.py
and the actual rows in the roles table.

Role IDs in database:
  1  = Super Admin
  2  = Hospital Admin
  3  = Receptionist
  4  = Doctor
  5  = Nurse
  6  = Lab Technician
  7  = Radiologist
  8  = Pharmacist
  9  = Billing Clerk
  10 = Inventory Manager
"""


class RoleId:
    """Immutable role ID constants. Never use raw integers — use these."""

    SUPER_ADMIN:        int = 1
    HOSPITAL_ADMIN:     int = 2
    RECEPTIONIST:       int = 3
    DOCTOR:             int = 4
    NURSE:              int = 5
    LAB_TECHNICIAN:     int = 6
    RADIOLOGIST:        int = 7
    PHARMACIST:         int = 8
    BILLING_CLERK:      int = 9
    INVENTORY_MANAGER:  int = 10

    # Convenience sets for multi-role checks
    ADMIN_ROLES:    frozenset = frozenset({SUPER_ADMIN, HOSPITAL_ADMIN})
    CLINICAL_ROLES: frozenset = frozenset({DOCTOR, NURSE, LAB_TECHNICIAN, RADIOLOGIST})
    ALL_ROLES:      frozenset = frozenset(range(1, 11))
