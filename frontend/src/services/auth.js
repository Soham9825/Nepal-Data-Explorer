const AUTH_BASE = import.meta.env.VITE_AUTH_URL || 'http://localhost:8000/accounts/api';
const USER_STORAGE_KEY = 'nepal-data-current-user';

export const auth = {
  getCSRF: async () => {
    const res = await fetch(`${AUTH_BASE}/csrf/`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to get CSRF token');
    return await res.json();
  },

  login: async ({ username, password, remember_me = false }) => {
    // ensure csrf cookie present
    const csrf = await auth.getCSRF();

    const res = await fetch(`${AUTH_BASE}/login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf.csrfToken || csrf.csrf_token || csrf.csrfToken,
      },
      body: JSON.stringify({ username, password, remember_me }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Login failed');
    }

    const user = await res.json();
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  logout: async () => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/logout/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrf.csrfToken || csrf.csrf_token },
    });
    if (res.ok) window.localStorage.removeItem(USER_STORAGE_KEY);
    return res.ok;
  },

  signup: async ({ username, email, password, confirm_password }) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/signup/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf.csrfToken || csrf.csrf_token },
      body: JSON.stringify({ username, email, password, confirm_password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Signup failed');
    }
    return await res.json();
  },

  getCurrentUser: async () => {
    const res = await fetch(`${AUTH_BASE}/me/`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) {
      window.localStorage.removeItem(USER_STORAGE_KEY);
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
      window.localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    }
  },
};

export default auth;
