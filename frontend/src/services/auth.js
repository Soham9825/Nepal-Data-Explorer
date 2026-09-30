import { AUTH_API_URL as AUTH_BASE } from '../config';
const USER_STORAGE_KEY = 'nepal-data-current-user';
const ACCESS_TOKEN_KEY = 'nepal-data-access-token';
const REFRESH_TOKEN_KEY = 'nepal-data-refresh-token';

// How long a successful /me/ answer is reused before we revalidate. The previous
// code had no cache at all, so every mounted consumer (ProtectedRoute,
// DashboardLayout, AdminRoute, Support) issued its own request, and StrictMode
// doubled that in dev — four identical GETs plus four preflights per page load.
const ME_CACHE_TTL_MS = 30000;

const csrfHeader = (csrf) => ({
  'Content-Type': 'application/json',
  'X-CSRFToken': csrf.csrfToken || csrf.csrf_token,
});

const parseError = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  throw new Error(data.detail || fallback);
};

// Single-flight guards: concurrent callers share one in-flight request instead
// of each firing their own.
let mePromise = null;
let refreshPromise = null;
let meCache = null;
let meCachedAt = 0;

const readStored = (key) => {
  try {
    return window.localStorage.getItem(key) || null;
  } catch {
    return null;
  }
};

const writeStored = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — auth still works for this tab */
  }
};

const removeStored = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

const jsonOrThrow = async (res, fallback) => {
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  throw new Error(data.detail || fallback);
};

/**
 * SimpleJWT tokens are `header.payload.signature`. Anything else in storage is
 * garbage — most often the literal text "undefined" written by the old
 * storeTokens, or a truncated/corrupted value.
 *
 * This matters more than it looks: JWTAuthentication *raises* InvalidToken for a
 * malformed header rather than falling back to anonymous, so a single bogus
 * token turns every AllowAny endpoint into a 401. That is the mechanism behind
 * "the app says I'm unauthorized even though I logged in" — a request that
 * works with no Authorization header fails once a junk one is attached.
 */
const looksLikeJwt = (token) =>
  typeof token === 'string' &&
  token !== 'undefined' &&
  token !== 'null' &&
  token.split('.').length === 3;

const readToken = (key) => {
  const token = readStored(key);
  if (token === null) return null;
  if (looksLikeJwt(token)) return token;
  // Drop it so the refresh path can take over instead of sending `Bearer undefined`.
  removeStored(key);
  return null;
};

const cacheUser = (user) => {
  meCache = user;
  meCachedAt = user ? Date.now() : 0;
  // Only persist a user we can identify. A stub carrying just `avatarUrl` would
  // make isAdmin() read undefined and strip admin chrome until the next /me.
  if (user && user.username) writeStored(USER_STORAGE_KEY, JSON.stringify(user));
  else if (!user) removeStored(USER_STORAGE_KEY);
};

/**
 * Fold an avatar change into the cached user without re-reading storage, so a
 * failed read can't downgrade the cached object to `{ avatarUrl }`.
 */
const cacheAvatarUrl = (avatarUrl) => {
  const current = meCache || auth.getCachedUser();
  const merged = { ...(current || {}), avatarUrl };
  meCache = merged;
  meCachedAt = Date.now();
  if (merged.username) writeStored(USER_STORAGE_KEY, JSON.stringify(merged));
  return merged;
};

// Exchange the still-valid refresh token for a new access token. The backend has
// ROTATE_REFRESH_TOKENS/BLACKLIST_AFTER_ROTATION on, so the response carries a
// replacement refresh token that must be stored or the next refresh is dead.
const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;

  const refresh = readStored(REFRESH_TOKEN_KEY);
  if (!refresh) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/token/refresh/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        auth.clearTokens();
        return null;
      }
      const data = await res.json();
      if (!data?.access) return null;
      writeStored(ACCESS_TOKEN_KEY, data.access);
      if (data.refresh) writeStored(REFRESH_TOKEN_KEY, data.refresh);
      return data.access;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export const auth = {
  getCSRF: async () => {
    const res = await fetch(`${AUTH_BASE}/csrf/`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to get CSRF token');
    return res.json();
  },

  getAccessToken: () => readToken(ACCESS_TOKEN_KEY),

  getRefreshToken: () => readToken(REFRESH_TOKEN_KEY),

  authenticatedHeaders: () => {
    const token = auth.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  storeTokens: (data) => {
    // Only ever persist real, well-formed tokens. Storing a missing field used
    // to write the literal text "undefined", which is truthy — so
    // `authenticatedHeaders()` happily sent `Authorization: Bearer undefined`
    // and *every* endpoint answered 401 with no obvious cause.
    if (looksLikeJwt(data?.access)) writeStored(ACCESS_TOKEN_KEY, data.access);
    if (looksLikeJwt(data?.refresh)) writeStored(REFRESH_TOKEN_KEY, data.refresh);
    meCache = null;
    meCachedAt = 0;
  },

  clearTokens: () => {
    removeStored(ACCESS_TOKEN_KEY);
    removeStored(REFRESH_TOKEN_KEY);
    removeStored(USER_STORAGE_KEY);
    meCache = null;
    meCachedAt = 0;
  },

  refreshAccessToken,

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
    cacheUser(user);
    return user;
  },

  logout: async () => {
    const token = auth.getAccessToken();
    if (token) {
      const res = await fetch(`${AUTH_BASE}/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...auth.authenticatedHeaders() },
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
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf.csrfToken || csrf.csrf_token,
      },
      body: JSON.stringify({ username, email, password, confirm_password }),
    });
    if (!res.ok) return parseError(res, 'Signup failed');
    const user = await res.json();
    if (user.access) {
      auth.storeTokens(user);
      cacheUser(user);
    }
    return user;
  },

  getCurrentUser: async ({ force = false } = {}) => {
    // No access token but a refresh token means the 30-minute access token
    // simply expired: refresh instead of treating the user as signed out.
    if (!auth.getAccessToken() && !auth.getRefreshToken()) {
      meCache = null;
      meCachedAt = 0;
      return null;
    }

    if (!force && meCache && Date.now() - meCachedAt < ME_CACHE_TTL_MS) return meCache;
    if (mePromise) return mePromise;

    mePromise = (async () => {
      try {
        let res = await fetch(`${AUTH_BASE}/me/`, {
          headers: auth.authenticatedHeaders(),
          credentials: 'include',
        });

        // A 401 here used to immediately wipe the stored tokens — including the
        // still-valid refresh token — so one expired access token turned into a
        // hard logout that looked like "I logged in but it says unauthorized".
        if (res.status === 401) {
          const fresh = await refreshAccessToken();
          if (!fresh) {
            cacheUser(null);
            return null;
          }
          res = await fetch(`${AUTH_BASE}/me/`, {
            headers: { Authorization: `Bearer ${fresh}` },
            credentials: 'include',
          });
        }

        if (!res.ok) {
          cacheUser(null);
          if (res.status === 401) auth.clearTokens();
          return null;
        }

        const user = await res.json();
        cacheUser(user);
        return user;
      } catch {
        // Network blip: keep whatever is cached rather than signing the user
        // out. Fall back to the persisted copy too, since the in-memory cache
        // is empty on a fresh page load.
        return meCache || auth.getCachedUser();
      } finally {
        mePromise = null;
      }
    })();

    return mePromise;
  },

  cacheUser,

  getCachedUser: () => {
    try {
      const raw = readStored(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      auth.clearTokens();
      return null;
    }
  },

  isAdmin: (user = null) => {
    const current = user || auth.getCachedUser();
    return !!(current && (current.is_staff || current.is_superuser));
  },
  requestPasswordReset: async (email) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/password-reset/request/`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfHeader(csrf),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return parseError(res, 'Could not send reset code');
    return res.json();
  },

  verifyPasswordResetOtp: async (email, otp) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/password-reset/verify/`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfHeader(csrf),
      body: JSON.stringify({ email, otp }),
    });
    if (!res.ok) return parseError(res, 'Invalid or expired reset code');
    return res.json();
  },

  confirmPasswordReset: async (reset_token, password) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/password-reset/confirm/`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfHeader(csrf),
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

  exchangeOAuthCode: async (code) => {
    const csrf = await auth.getCSRF();
    const res = await fetch(`${AUTH_BASE}/oauth/exchange/`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfHeader(csrf),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return parseError(res, 'OAuth sign-in failed');
    return res.json();
  },
};

/**
 * Profile & saved collections.
 *
 * These calls decorate an access token with the auth machinery above. Media (the
 * avatar image) is served from the same Django origin, which the Vite dev proxy
 * forwards under `/media`.
 */

/** Signals the layout to re-read `/me` after a profile change (e.g. a new avatar). */
const notifyUserUpdated = () => {
  try {
    window.dispatchEvent(new CustomEvent('nde-user-updated'));
  } catch {
    /* not in a browser */
  }
};

const authFetch = async (path, options = {}) => {
  const doFetch = (token) =>
    fetch(`${AUTH_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

  let res = await doFetch(auth.getAccessToken());

  // An expired 30-minute access token would otherwise 401 every profile and
  // collection call thirty minutes into a session. Refresh once and retry — the
  // same recovery the /me/ path already uses.
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await doFetch(fresh);
  }

  if (res.status === 204) return null;
  return jsonOrThrow(res, `${res.status} ${res.statusText}`);
};

export const profileApi = {
  get: () => authFetch('/profile/'),

  /* Upload a new avatar image (multipart). */
  updateAvatar: async (file) => {
    const form = new FormData();
    form.append('avatar', file);
    const data = await authFetch('/profile/', { method: 'PATCH', body: form });
    cacheAvatarUrl(data.avatarUrl);
    notifyUserUpdated();
    return data;
  },

  /* Clear the avatar so the profile falls back to initials. */
  removeAvatar: async () => {
    const data = await authFetch('/profile/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remove_avatar: true }),
    });
    cacheAvatarUrl(null);
    notifyUserUpdated();
    return data;
  },
};

export const collectionsApi = {
  list: async () => {
    const data = await authFetch('/collections/');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nde-collections-loaded', { detail: data.collections || [] })
      );
    }
    return data;
  },

  create: async ({ name, description = '', section = 'tourism' }) => {
    const data = await authFetch('/collections/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, section }),
    });
    return data;
  },

  rename: async (id, { name, description }) =>
    authFetch(`/collections/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    }),

  remove: (id) => authFetch(`/collections/${id}/`, { method: 'DELETE' }),

  addItem: (collectionId, item) =>
    authFetch(`/collections/${collectionId}/items/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }),

  removeItem: (collectionId, itemId) =>
    authFetch(`/collections/${collectionId}/items/${itemId}/`, { method: 'DELETE' }),

  toggle: async (item) => {
    const data = await authFetch('/collections/toggle/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return data;
  },
};

export default auth;
