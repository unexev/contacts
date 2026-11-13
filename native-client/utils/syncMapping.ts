/**
 * Pure mapping helpers between backend sync rows and the local SQLite schema.
 * No react-native / expo imports so it can run under `node --test`.
 */

export type LocalGender = 'MALE' | 'FEMALE';

/** Marital status ids seeded locally (see dbSchema seedSql); `contact.status_id` has a FK to them. */
const KNOWN_STATUS_IDS = new Set(['soltero', 'casado', 'divorciado', 'viudo', 'union_libre', 'separado']);

/** The local `contact.gender` CHECK only allows 'MALE' | 'FEMALE'; the backend may send 'M' / 'F'. */
export function normalizeGender(value: string | null | undefined): LocalGender | null {
  const v = (value ?? '').trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'MALE';
  if (v === 'F' || v === 'FEMALE') return 'FEMALE';
  return null;
}

/** Real-life relationship situation, independent of the legal marital status. */
export const RELATIONSHIP_STATUSES = ['SINGLE', 'PARTNERED', 'COHABITING'] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

/** Upper bound accepted for `children_count` (the DB only enforces >= 0). */
export const MAX_CHILDREN_COUNT = 50;

/** Returns the known relationship status, or null (= unknown) for anything else. */
export function normalizeRelationshipStatus(value: string | null | undefined): RelationshipStatus | null {
  const v = (value ?? '').trim().toUpperCase();
  return (RELATIONSHIP_STATUSES as readonly string[]).includes(v) ? (v as RelationshipStatus) : null;
}

/**
 * Returns an integer children count in 0..MAX_CHILDREN_COUNT, or null (= unknown) for empty or invalid input.
 * Accepts numbers and digit-only strings (form input).
 */
export function normalizeChildrenCount(value: unknown): number | null {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    n = Number(value.trim());
  } else {
    return null;
  }
  return Number.isInteger(n) && n >= 0 && n <= MAX_CHILDREN_COUNT ? n : null;
}

export function normalizeStatusId(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().toLowerCase();
  return KNOWN_STATUS_IDS.has(v) ? v : null;
}

/** Backend timestamps are epoch milliseconds; local columns use `datetime('now')` text (UTC). */
export function msToSqliteDatetime(ms: number | null | undefined): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * The backend serializes Go `sql.NullString` columns (such as phone/email labels) as `{ String, Valid }`.
 * Returns the trimmed text, or null when the value is empty, invalid or not a string-like shape.
 */
export function nullStringValue(value: unknown): string | null {
  let text: unknown = value;
  if (value && typeof value === 'object') {
    const ns = value as { String?: unknown; Valid?: unknown };
    text = ns.Valid === true ? ns.String : null;
  }
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

const LOCAL_BIRTHDATE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

/** The backend stores birthdates as ISO `YYYY-MM-DD`; the app stores and parses `DD/MM/YYYY`. */
export function isoToLocalBirthdate(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (LOCAL_BIRTHDATE.test(v)) return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(v);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = year >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

export interface BackendContact {
  contact_id: string;
  first_name: string;
  middle_name?: string | null;
  surname: string;
  birthdate?: string | null;
  gender?: string | null;
  status_id?: string | null;
  relationship_status?: string | null;
  children_count?: number | null;
  updated_at?: number;
}

export function mapContactRow(c: BackendContact) {
  return {
    contact_id: c.contact_id,
    first_name: c.first_name,
    middle_name: c.middle_name || null,
    surname: c.surname,
    birthdate: isoToLocalBirthdate(c.birthdate),
    gender: normalizeGender(c.gender),
    status_id: normalizeStatusId(c.status_id),
    relationship_status: normalizeRelationshipStatus(c.relationship_status),
    children_count: normalizeChildrenCount(c.children_count),
    updated_at: msToSqliteDatetime(c.updated_at),
  };
}

/** Go `sql.NullString` JSON shape expected by the backend on /api/sync/push. */
export interface NullString { String: string; Valid: boolean }
/** Go `sql.NullInt64` JSON shape expected by the backend on /api/sync/push. */
export interface NullInt64 { Int64: number; Valid: boolean }

export function toNullString(value: string | null | undefined): NullString {
  return value ? { String: value, Valid: true } : { String: '', Valid: false };
}

export function toNullInt64(value: number | null | undefined): NullInt64 {
  return typeof value === 'number' && Number.isFinite(value) ? { Int64: value, Valid: true } : { Int64: 0, Valid: false };
}

/**
 * Nullable contact columns encoded for a sync push payload: the backend decodes pushed contacts
 * straight into Go `sql.Null*` fields, so plain values or null would be rejected.
 */
export function contactPushNullFields(c: {
  gender?: string | null;
  status_id?: string | null;
  relationship_status?: string | null;
  children_count?: number | null;
}) {
  return {
    gender: toNullString(c.gender),
    status_id: toNullString(c.status_id),
    relationship_status: toNullString(normalizeRelationshipStatus(c.relationship_status)),
    children_count: toNullInt64(normalizeChildrenCount(c.children_count)),
  };
}
