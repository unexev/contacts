const BASE = (import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || 'https://contacts-lac-three.vercel.app')).replace(/\/+$/, '');

export const A = $state({ token: '', user: null });

export function loadToken() {
  try {
    const saved = localStorage.getItem('auth_token');
    if (saved) A.token = saved;
  } catch {}
}

export function setToken(t) {
  A.token = t;
  try {
    if (t) {
      localStorage.setItem('auth_token', t);
    } else {
      localStorage.removeItem('auth_token');
    }
  } catch {}
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (A.token) headers.Authorization = 'Bearer ' + A.token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
  if (res.status === 401) { setToken(''); throw new Error('Invalid credentials'); }
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const safeMsg = res.status === 401 ? 'Invalid credentials' :
                    res.status === 409 ? 'Invalid request' :
                    res.status === 400 ? (raw?.error || 'Invalid input') :
                    'Something went wrong';
    throw new Error(safeMsg);
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
  if (A.token) headers.Authorization = 'Bearer ' + A.token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
  if (res.status === 401) { setToken(''); throw new Error('Invalid credentials'); }
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const safeMsg = res.status === 401 ? 'Invalid credentials' :
                    res.status === 409 ? 'Invalid request' :
                    res.status === 400 ? 'Invalid input' :
                    'Something went wrong';
    throw new Error(safeMsg);
  }
  return raw;
}
