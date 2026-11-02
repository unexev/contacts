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
    birthdate: c.birthdate || null,
    gender: normalizeGender(c.gender),
    status_id: normalizeStatusId(c.status_id),
    updated_at: msToSqliteDatetime(c.updated_at),
  };
}
