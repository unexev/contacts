/**
 * Pure helpers for email/password auth against the Go backend.
 * No react-native / expo imports so it can run under `node --test`.
 * Failures are reported as stable i18n KEYS, never display text.
 */

export const MIN_PASSWORD_LENGTH = 8;

export type AuthErrorKey =
  | 'authEmailInvalid'
  | 'authPasswordShort'
  | 'authNameRequired'
  | 'authInvalidCredentials'
  | 'authEmailTaken'
  | 'authRequestInvalid'
  | 'authRateLimited'
  | 'authNetwork'
  | 'authGeneric';

export interface ApiUser {
  id?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface ApiSession {
  token: string;
  refreshToken: string;
  user: ApiUser | null;
}

export type AuthResult = { ok: true; session: ApiSession } | { ok: false; errorKey: AuthErrorKey };

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{ status: number; json: () => Promise<any> }>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): AuthErrorKey | null {
  return EMAIL_RE.test(email.trim()) ? null : 'authEmailInvalid';
}

export function validatePassword(password: string): AuthErrorKey | null {
  return password.length >= MIN_PASSWORD_LENGTH ? null : 'authPasswordShort';
}

export function validateName(name: string): AuthErrorKey | null {
  return name.trim().length > 0 ? null : 'authNameRequired';
}

/** Maps a non-success HTTP status (0 = network failure) to an error key. */
export function mapAuthFailure(status: number): AuthErrorKey {
  if (status === 0) return 'authNetwork';
  if (status === 401) return 'authInvalidCredentials';
  if (status === 409) return 'authEmailTaken';
  if (status === 400) return 'authRequestInvalid';
  if (status === 429) return 'authRateLimited';
  return 'authGeneric';
}

async function post(fetchFn: FetchLike, apiBase: string, path: string, payload: object): Promise<AuthResult> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, errorKey: 'authNetwork' };
  }

  if (res.status < 200 || res.status >= 300) {
    return { ok: false, errorKey: mapAuthFailure(res.status) };
  }

  const body = await res.json().catch(() => null);
  const data = body?.data;
  if (!data || typeof data.token !== 'string' || typeof data.refresh_token !== 'string') {
    return { ok: false, errorKey: 'authGeneric' };
  }
  return { ok: true, session: { token: data.token, refreshToken: data.refresh_token, user: data.user ?? null } };
}

export async function loginRequest(
  fetchFn: FetchLike,
  apiBase: string,
  email: string,
  password: string
): Promise<AuthResult> {
  const invalid = validateEmail(email) ?? (password.length === 0 ? 'authPasswordShort' : null);
  if (invalid) return { ok: false, errorKey: invalid };
  return post(fetchFn, apiBase, '/api/auth/login', { email: email.trim(), password });
}

export async function registerRequest(
  fetchFn: FetchLike,
  apiBase: string,
  email: string,
  name: string,
  password: string
): Promise<AuthResult> {
  const invalid = validateEmail(email) ?? validateName(name) ?? validatePassword(password);
  if (invalid) return { ok: false, errorKey: invalid };
  return post(fetchFn, apiBase, '/api/auth/register', { email: email.trim(), name: name.trim(), password });
}
