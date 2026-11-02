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
    updated_at: msToSqliteDatetime(c.updated_at),
  };
}
