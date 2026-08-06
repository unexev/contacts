const BASE = import.meta.env.VITE_API_BASE_URL || '';
const TOKEN_KEY = 'contacts_token';

export const A = $state({ token: '', user: null });

export function loadToken() {
  try { A.token = localStorage.getItem(TOKEN_KEY) || ''; } catch {}
}

export function setToken(t) {
  A.token = t;
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (A.token) headers.Authorization = 'Bearer ' + A.token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
  if (res.status === 401) { setToken(''); throw new Error('unauthorized'); }
  const raw = await res.json().catch(() => null);
  if (!res.ok) throw new Error(raw?.error || 'Error ' + res.status);
  return raw?.data !== undefined ? raw.data : raw;
}
