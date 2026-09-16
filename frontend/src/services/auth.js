const AUTH_BASE = import.meta.env.VITE_AUTH_URL || 'http://localhost:8000/accounts/api';
const USER_STORAGE_KEY = 'nepal-data-current-user';
const ACCESS_TOKEN_KEY = 'nepal-data-access-token';
const REFRESH_TOKEN_KEY = 'nepal-data-refresh-token';

const csrfHeader = (csrf) => ({
  'Content-Type': 'application/json',
  'X-CSRFToken': csrf.csrfToken || csrf.csrf_token,
});

const parseError = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  throw new Error(data.detail || fallback);
};

export const auth = {
  getCSRF: async () => {
    const res = await fetch(`${AUTH_BASE}/csrf/`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to get CSRF token');
    return res.json();
  },

  getAccessToken: () => window.localStorage.getItem(ACCESS_TOKEN_KEY),

  authenticatedHeaders: () => {
    const token = auth.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  storeTokens: (data) => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
  },

  clearTokens: () => {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  },

  login: async ({ username, password }) => {
    const csrf = await auth.getCSRF();

    const res = await fetch(`${AUTH_BASE}/login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf.csrfToken || csrf.csrf_token,
      },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Login failed');
    }

    const user = await res.json();
    auth.storeTokens(user);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  logout: async () => {
    const token = auth.getAccessToken();
    if (token) {
      const res = await fetch(`${AUTH_BASE}/logout/`, {
        method: 'POST', credentials: 'include', headers: { ...auth.authenticatedHeaders() },
      });
      if (!res.ok && res.status !== 401) return false;
    }
    auth.clearTokens();
    return true;
  },

  signup: async ({ username, email, password, confirm_password }) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/signup/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf.csrfToken || csrf.csrf_token },
      body: JSON.stringify({ username, email, password, confirm_password }),
    });
    if (!res.ok) return parseError(res, 'Signup failed');
    const user = await res.json();
    auth.storeTokens(user);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  getCurrentUser: async () => {
    const res = await fetch(`${AUTH_BASE}/me/`, {
      headers: auth.authenticatedHeaders(), credentials: 'include',
    });
    if (!res.ok) {
      auth.clearTokens();
      return null;
    }
    const user = await res.json();
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  getCachedUser: () => {
    try {
      return JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY) || 'null');
    } catch {
      auth.clearTokens();
      return null;
    }
  },
  requestPasswordReset: async (email) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/password-reset/request/`, {
      method: 'POST', credentials: 'include', headers: csrfHeader(csrf),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return parseError(res, 'Could not send reset code');
    return res.json();
  },

  verifyPasswordResetOtp: async (email, otp) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/password-reset/verify/`, {
      method: 'POST', credentials: 'include', headers: csrfHeader(csrf),
      body: JSON.stringify({ email, otp }),
    });
    if (!res.ok) return parseError(res, 'Invalid or expired reset code');
    return res.json();
  },

  confirmPasswordReset: async (reset_token, password) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/password-reset/confirm/`, {
      method: 'POST', credentials: 'include', headers: csrfHeader(csrf),
      body: JSON.stringify({ reset_token, password }),
    });
    if (!res.ok) return parseError(res, 'Could not reset password');
    return res.json();
  },

  sendVerificationEmail: async () => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/send-verification-email/`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...csrfHeader(csrf), ...auth.authenticatedHeaders() },
    });
    if (!res.ok) return parseError(res, 'Could not send verification email');
    return res.json();
  },

  verifyEmail: async (token) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/verify-email/`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfHeader(csrf),
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return parseError(res, 'Invalid or expired verification link');
    return res.json();
  },
};

export default auth;
