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
  | 'authVerificationRequired'
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
  if (status === 403) return 'authVerificationRequired';
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
  // Register answers 2xx without tokens while the email still needs confirming.
  if (data?.verification_required) return { ok: false, errorKey: 'authVerificationRequired' };
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

export type ResendResult = { ok: true } | { ok: false; reason: 'wait' | 'done' | 'failed' };

/** Asks the backend to email a new confirmation link (public: email + password prove ownership). */
export async function resendVerificationRequest(
  fetchFn: FetchLike,
  apiBase: string,
  email: string,
  password: string
): Promise<ResendResult> {
  try {
    const res = await fetchFn(`${apiBase}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    if (res.status >= 200 && res.status < 300) return { ok: true };
    if (res.status === 429) return { ok: false, reason: 'wait' };
    if (res.status === 409) return { ok: false, reason: 'done' };
  } catch {
    // fall through to generic failure
  }
  return { ok: false, reason: 'failed' };
}

export type DeleteAccountError = 'wrongPassword' | 'wait' | 'network' | 'failed';

/** Maps the DELETE /api/auth/me failure status (0 = network failure) to a reason. */
export function mapDeleteFailure(status: number): DeleteAccountError {
  if (status === 0) return 'network';
  if (status === 401) return 'wrongPassword';
  if (status === 429) return 'wait';
  return 'failed';
}

export type CredentialsErrorKey =
  | 'accountCurrentRequired'
  | 'accountNothingToChange'
  | 'accountPasswordMismatch'
  | 'accountWrongPassword'
  | AuthErrorKey;

export interface CredentialsForm {
  currentPassword: string;
  newEmail: string;
  newPassword: string;
  confirmPassword: string;
}

/** Same checks, in the same order, as the web account page. */
export function validateCredentialsChange(form: CredentialsForm): CredentialsErrorKey | null {
  if (!form.currentPassword) return 'accountCurrentRequired';
  const email = form.newEmail.trim();
  if (!email && !form.newPassword) return 'accountNothingToChange';
  if (email) {
    const bad = validateEmail(email);
    if (bad) return bad;
  }
  if (form.newPassword) {
    const bad = validatePassword(form.newPassword);
    if (bad) return bad;
    if (form.newPassword !== form.confirmPassword) return 'accountPasswordMismatch';
  }
  return null;
}

/** Body of PUT /api/auth/me: only what is being changed, plus the current password. */
export function credentialsBody(form: CredentialsForm): Record<string, string> {
  const body: Record<string, string> = { current_password: form.currentPassword };
  const email = form.newEmail.trim();
  if (email) body.email = email;
  if (form.newPassword) body.new_password = form.newPassword;
  return body;
}

/** Maps a failed PUT /api/auth/me status (0 = network failure) to an error key. */
export function mapCredentialsFailure(status: number): CredentialsErrorKey {
  if (status === 401) return 'accountWrongPassword';
  return mapAuthFailure(status);
}

export type CredentialsOutcome =
  | { kind: 'session'; token: string; refreshToken: string }
  | { kind: 'verify' }
  | { kind: 'invalid' };

/** The new email must be confirmed first (no session), or fresh tokens replace the old ones. */
export function readCredentialsResponse(data: any): CredentialsOutcome {
  if (data?.verification_required) return { kind: 'verify' };
  if (data && typeof data.token === 'string' && typeof data.refresh_token === 'string') {
    return { kind: 'session', token: data.token, refreshToken: data.refresh_token };
  }
  return { kind: 'invalid' };
}
