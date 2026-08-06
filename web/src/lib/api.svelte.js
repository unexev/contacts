const BASE = (import.meta.env.VITE_API_BASE_URL || 'https://contacts-lac-three.vercel.app').replace(/\/+$/, '');

export const A = $state({ token: '', user: null });

export function loadToken() {
  // Token is now in httpOnly cookie, no need to load from localStorage
}

export function setToken(t) {
  A.token = t;
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (A.token) headers.Authorization = 'Bearer ' + A.token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal, credentials: 'include' });
  if (res.status === 401) { setToken(''); throw new Error('Invalid credentials'); }
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const safeMsg = res.status === 401 ? 'Invalid credentials' :
                    res.status === 409 ? 'Invalid request' :
                    res.status === 400 ? 'Invalid input' :
                    'Something went wrong';
    throw new Error(safeMsg);
  }
  return raw?.data !== undefined ? raw.data : raw;
}
