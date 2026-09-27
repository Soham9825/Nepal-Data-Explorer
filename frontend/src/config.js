// Centralized API origins. Override via frontend/.env.local:
//   VITE_API_URL=http://localhost:8000
//   VITE_AUTH_URL=http://localhost:8000/accounts/api
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const AUTH_API_URL = import.meta.env.VITE_AUTH_URL || `${API_BASE_URL}/accounts/api`;
