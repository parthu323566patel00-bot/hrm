/**
 * services/userService.js
 * -----------------------
 * User-related API calls.
 */

import { apiFetch } from './api';

/**
 * Fetch the currently authenticated user's profile.
 *
 * @param {string} token - JWT bearer token
 * @returns {Promise<object>} User profile object
 */
export async function fetchUserProfile(token) {
  return apiFetch('/users/me', {}, token);
}

/**
 * Generate a staff invitation link.
 * Department assignment is no longer part of the invitation flow —
 * doctors select their own departments after registration.
 *
 * @param {string} token  - JWT bearer token of the inviting admin
 * @param {string} email  - Email of the invitee
 * @param {number} roleId - Role ID to assign
 * @returns {Promise<object>} Invitation response including invite_link
 */
export async function createInvitation(token, email, roleId) {
  return apiFetch(
    '/users/invite',
    {
      method: 'POST',
      body: JSON.stringify({ email, role_id: roleId }),
    },
    token,
  );
}

/**
 * Update the currently authenticated user's profile.
 *
 * @param {string} token      - JWT bearer token
 * @param {object} updateData - Object containing updated fields
 * @returns {Promise<object>} Updated User profile object
 */
export async function updateUserProfile(token, updateData) {
  return apiFetch(
    '/users/me',
    {
      method: 'PUT',
      body: JSON.stringify(updateData),
    },
    token,
  );
}

/**
 * Fetch the current user's department memberships.
 *
 * @param {string} token - JWT bearer token
 * @returns {Promise<Array>} List of { id, name, code } department objects
 */
export async function fetchMyDepartments(token) {
  return apiFetch('/users/me/departments', {}, token);
}

/**
 * Replace the current user's department memberships.
 *
 * @param {string} token         - JWT bearer token
 * @param {number[]} departmentIds - Array of department IDs to assign
 * @returns {Promise<object>} Updated membership response
 */
export async function updateMyDepartments(token, departmentIds) {
  return apiFetch(
    '/users/me/departments',
    {
      method: 'PUT',
      body: JSON.stringify(departmentIds),
    },
    token,
  );
}
