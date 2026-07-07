/**
 * services/authService.js
 * -----------------------
 * All authentication-related API calls:
 *  - RSA public key fetch (with retry)
 *  - Login
 *  - Invite token validation
 *  - Invited user registration
 */

import { API_BASE_URL } from '../constants';

/**
 * Fetch the RSA public key from the backend.
 * Retries up to `retries` times with a 2-second delay between attempts.
 *
 * @param {number} retries - Max number of attempts (default 3)
 * @returns {Promise<string>} PEM-encoded public key string
 */
export async function fetchPublicKey(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/public-key`);
      if (!response.ok) throw new Error('Failed to fetch public key.');
      const data = await response.json();
      return data.public_key;
    } catch (err) {
      console.error(`Public key fetch attempt ${attempt}/${retries} failed:`, err);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw new Error('Cryptographic setup not ready. Public key not found.');
      }
    }
  }
}

/**
 * Authenticate with the backend using OAuth2 form-encoded credentials.
 * The password MUST already be RSA-encrypted + base64-encoded before calling.
 *
 * @param {string} email
 * @param {string} encryptedPassword - RSA-encrypted, base64-encoded password
 * @returns {Promise<{ access_token: string, token_type: string }>}
 */
export async function login(email, encryptedPassword) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', encryptedPassword);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Authentication failed. Please verify credentials.');
  }
  return data;
}

/**
 * Validate an invitation token and return the invitation metadata.
 *
 * @param {string} token - The raw invite token from the URL query string
 * @returns {Promise<{ email: string, tenant_id: string, role_id: number, role_name: string }>}
 */
export async function validateInviteToken(token) {
  const response = await fetch(`${API_BASE_URL}/auth/invite/validate?token=${token}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Invitation is invalid or has expired.');
  }
  return data;
}

/**
 * Complete account registration for an invited user.
 * The password MUST already be RSA-encrypted + base64-encoded before calling.
 *
 * @param {string} token             - The invitation token
 * @param {string} encryptedPassword - RSA-encrypted, base64-encoded password
 * @returns {Promise<object>} Newly created user object
 */
export async function registerInvitedUser(token, encryptedPassword) {
  const response = await fetch(`${API_BASE_URL}/auth/invite/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: encryptedPassword }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Account completion failed.');
  }
  return data;
}
