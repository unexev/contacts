const BASE = (import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || 'https://contacts-lac-three.vercel.app')).replace(/\/+$/, '');

import { clearCache } from './cache.svelte.js';

export const A = $state({ token: '', user: null });

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';

function stored(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function store(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

export function loadToken() {
  const saved = stored(TOKEN_KEY);
  if (saved) A.token = saved;
}

// The access token is short-lived; the refresh token renews it. An empty token
// ends the session and drops both.
export function setToken(t, refreshToken = '') {
  A.token = t;
  if (!t) clearCache();
  store(TOKEN_KEY, t);
  if (!t || refreshToken) store(REFRESH_KEY, refreshToken);
}

// Ends the session here and revokes its refresh token on the server.
export function logout() {
  const refreshToken = stored(REFRESH_KEY);
  setToken('');
  A.user = null;
  if (refreshToken) {
    fetch(BASE + '/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      keepalive: true
    }).catch(() => {});
  }
}

let refreshing = null;

// Trades the refresh token for a new session; concurrent callers share one request.
// Storage is the source of truth because another tab may have renewed already.
function renewSession(usedToken) {
  const current = stored(TOKEN_KEY);
  if (current && current !== usedToken) {
    A.token = current;
    return Promise.resolve(true);
  }
  refreshing ??= (async () => {
    const refreshToken = stored(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      const res = await fetch(BASE + '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      const data = (await res.json().catch(() => null))?.data;
      if (!res.ok || !data?.token || !data?.refresh_token) return false;
      setToken(data.token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

// Sends the request with the current access token. A 401 from the auth
// middleware ("unauthorized") means that token expired, so the session is
// renewed and the request retried once; any other 401 is a rejected password.
async function send(path, { method, headers, body, signal }) {
  const attempt = () => {
    const h = { ...headers };
    if (A.token) h.Authorization = 'Bearer ' + A.token;
    return fetch(BASE + path, { method, headers: h, body, signal });
  };
  const usedToken = A.token;
  let res = await attempt();
  let raw = await res.json().catch(() => null);
  let expired = res.status === 401 && raw?.error === 'unauthorized';
  if (expired && usedToken && await renewSession(usedToken)) {
    res = await attempt();
    raw = await res.json().catch(() => null);
    expired = res.status === 401 && raw?.error === 'unauthorized';
  }
  return { res, raw, expired };
}

// keepSession: a 401 means a wrong re-entered password, not an expired session.
export async function api(path, { method = 'GET', body, signal, keepSession = false } = {}) {
  // FormData: leave Content-Type unset so the browser adds the multipart boundary.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = isForm ? {} : { 'Content-Type': 'application/json' };
  const { res, raw, expired } = await send(path, { method, headers, body: !body ? undefined : isForm ? body : JSON.stringify(body), signal });
  if (res.status === 401) {
    if (expired || !keepSession) setToken('');
    throw Object.assign(new Error('Invalid credentials'), { status: 401, expired });
  }
  if (res.status === 403 && raw?.error === 'email not verified') {
    setToken('');
    throw Object.assign(new Error('Email not verified'), { status: 403, unverified: true });
  }
  if (!res.ok) {
    const safeMsg = res.status === 409 ? 'Invalid request' :
                    res.status === 400 ? (raw?.error || 'Invalid input') :
                    res.status === 429 ? 'Too many requests' :
                    'Something went wrong';
    throw Object.assign(new Error(safeMsg), { status: res.status });
  }
  return raw?.data !== undefined ? raw.data : raw;
}

// Paginated endpoints cap each page (backend max 100), so callers that need the
// complete list must walk every page using the response `total`.
export async function apiAll(path, { pageSize = 100 } = {}) {
  const separator = path.includes('?') ? '&' : '?';
  const all = [];
  for (let offset = 0; ; offset += pageSize) {
    const res = await apiRaw(`${path}${separator}limit=${pageSize}&offset=${offset}`);
    const page = Array.isArray(res?.data) ? res.data : [];
    all.push(...page);
    const total = Number(res?.total ?? all.length);
    if (page.length < pageSize || all.length >= total) return all;
  }
}

export async function apiRaw(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const { res, raw } = await send(path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
  if (res.status === 401) { setToken(''); throw new Error('Invalid credentials'); }
  if (!res.ok) {
    const safeMsg = res.status === 409 ? 'Invalid request' :
                    res.status === 400 ? 'Invalid input' :
                    'Something went wrong';
    throw new Error(safeMsg);
  }
  return raw;
}
