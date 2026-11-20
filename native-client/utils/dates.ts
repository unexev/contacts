/**
 * Calendar dates. The stored format is ISO `YYYY-MM-DD`, the one the backend
 * uses, so synced rows need no conversion. `DD/MM/YYYY` is only how dates are
 * typed and shown. Parsing also accepts the legacy `D/M/YYYY` so data written
 * by older versions (or merged from an old backup) keeps working.
 * Pure module: no react-native / expo imports, runnable under `node --test`.
 */

export interface DateParts {
  day: number;
  month: number;
  year: number;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/;
const LEGACY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Day/month/year of a stored or typed date, or null when empty or not a real date. */
export function parseDate(value: string | null | undefined): DateParts | null {
  const text = (value ?? '').trim();
  let m = ISO.exec(text);
  if (m) {
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(year, month, day) ? { day, month, year } : null;
  }
  m = LEGACY.exec(text);
  if (m) {
    const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(year, month, day) ? { day, month, year } : null;
  }
  return null;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** ISO `YYYY-MM-DD` for storage; null for empty or invalid input. */
export function toIsoDate(value: string | null | undefined): string | null {
  const p = parseDate(value);
  return p ? `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}` : null;
}

/** `DD/MM/YYYY` for display and form fields; '' for empty or invalid input. */
export function toDisplayDate(value: string | null | undefined): string {
  const p = parseDate(value);
  return p ? `${pad(p.day)}/${pad(p.month)}/${pad(p.year, 4)}` : '';
}

/** Sortable number (YYYYMMDD) or null. */
export function dateSortKey(value: string | null | undefined): number | null {
  const p = parseDate(value);
  return p ? p.year * 10000 + p.month * 100 + p.day : null;
}
