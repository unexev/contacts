/** Validation and display of a contact's locations and nationalities. Pure, runs under `node --test`. */
// The explicit extension lets `node --test` resolve these files; tsconfig does not allow it.
// @ts-ignore TS5097
import { isValidCountryCode } from "./countries.ts";
// @ts-ignore TS5097
import { parseDate, toIsoDate } from "./dates.ts";

/** Same set as the web client; an empty type is allowed. */
export const LOCATION_TYPES = ["birth", "residence", "work", "other"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export type CoordinateResult = { ok: true; value: number | null } | { ok: false };

/** Empty is "no value"; otherwise a plain decimal (point or comma) within ±limit. */
export function parseCoordinate(input: string, limit: number): CoordinateResult {
  const text = input.trim().replace(",", ".");
  if (text === "") return { ok: true, value: null };
  if (!/^-?\d+(\.\d+)?$/.test(text)) return { ok: false };
  const value = Number(text);
  return Math.abs(value) <= limit ? { ok: true, value } : { ok: false };
}

const clean = (s: string) => s.trim() || null;

export interface LocationInput {
  type: string;
  address: string; city: string; region: string; country: string; postalCode: string;
  latitude: string; longitude: string;
}

export interface LocationValues {
  locationType: string;
  address: string | null; city: string | null; region: string | null; country: string | null; postalCode: string | null;
  latitude: number | null; longitude: number | null;
}

export type LocationValidation =
  | { ok: true; value: LocationValues }
  | { ok: false; error: "empty" | "latitude" | "longitude" | "coordinates" };

export function validateLocation(input: LocationInput): LocationValidation {
  const text = [input.address, input.city, input.region, input.country, input.postalCode];
  if (text.every((s) => s.trim() === "")) return { ok: false, error: "empty" };
  const lat = parseCoordinate(input.latitude, 90);
  if (!lat.ok) return { ok: false, error: "latitude" };
  const lng = parseCoordinate(input.longitude, 180);
  if (!lng.ok) return { ok: false, error: "longitude" };
  // A point needs both numbers.
  if ((lat.value === null) !== (lng.value === null)) return { ok: false, error: "coordinates" };
  return {
    ok: true,
    value: {
      locationType: (LOCATION_TYPES as readonly string[]).includes(input.type) ? input.type : "",
      address: clean(input.address), city: clean(input.city), region: clean(input.region),
      country: clean(input.country), postalCode: clean(input.postalCode),
      latitude: lat.value, longitude: lng.value,
    },
  };
}

export interface NationalityInput { countryCode: string | null; acquiredAt: string; note: string }

export type NationalityValidation =
  | { ok: true; value: { countryCode: string; acquiredAt: string | null; note: string | null } }
  | { ok: false; error: "country" | "date" };

export function validateNationality(input: NationalityInput): NationalityValidation {
  if (!input.countryCode || !isValidCountryCode(input.countryCode)) return { ok: false, error: "country" };
  const when = input.acquiredAt.trim();
  if (when && !parseDate(when)) return { ok: false, error: "date" };
  return {
    ok: true,
    value: { countryCode: input.countryCode.toUpperCase(), acquiredAt: when ? toIsoDate(when) : null, note: clean(input.note) },
  };
}

export function locationSummary(l: { address: string | null; city: string | null; region: string | null; country: string | null; postal_code: string | null }): string {
  return [l.address, l.city, l.region, l.country, l.postal_code].filter((p) => p && p.trim()).join(", ");
}
