const AUTH_BASE = import.meta.env.VITE_AUTH_URL || 'http://localhost:8000/accounts/api';

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

    return await res.json();
  },

  logout: async () => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/logout/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrf.csrfToken || csrf.csrf_token },
    });
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
    if (!res.ok) return null;
    return await res.json();
  },
};

export default auth;
