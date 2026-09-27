// Centralized API origins.
//
// Dev defaults to same-origin (empty string) and relies on the Vite dev proxy in
// vite.config.js to forward /api, /accounts and /admin to Django on :8000.
// That keeps every request same-origin, so the browser never issues a CORS
// `OPTIONS` preflight — previously the cross-origin default forced a preflight
// for nearly every call because they carry `Authorization` / `Content-Type`.
//
// Production still points at an absolute URL, e.g. frontend/.env.local:
//   VITE_API_URL=https://api.example.com
//   VITE_AUTH_URL=https://api.example.com/accounts/api
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";
export const AUTH_API_URL = import.meta.env.VITE_AUTH_URL || `${API_BASE_URL}/accounts/api`;
