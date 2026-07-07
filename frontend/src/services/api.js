/**
 * services/api.js
 * ---------------
 * Thin base wrapper around the native Fetch API.
 *
 * Provides a single `apiFetch()` helper that:
 *  - Prefixes the configured API_BASE_URL
 *  - Injects the Authorization Bearer header when a token is available
 *  - Returns the parsed JSON body (throws on non-2xx responses)
 */

import { API_BASE_URL } from '../constants';

/**
 * @param {string} path       - e.g. '/auth/login'
 * @param {RequestInit} opts  - Standard fetch options (method, body, headers…)
 * @param {string} [token]    - JWT token to attach as Bearer header
 * @returns {Promise<any>}    Parsed JSON response body
 */
export async function apiFetch(path, opts = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || `Request failed with status ${response.status}`);
  }

  return data;
}
