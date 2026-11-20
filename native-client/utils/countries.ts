/** Countries offered for a document; `OTHER` covers any not listed. Same list as the web client. */
export const COUNTRY_CODES = [
  'EC', 'AR', 'BO', 'BR', 'CL', 'CO', 'PE', 'VE', 'UY', 'PY', 'MX', 'US', 'CA', 'ES', 'IT',
  'FR', 'DE', 'PT', 'GB', 'CN', 'JP', 'KR', 'IN', 'RU', 'AU', 'OTHER',
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const CODE_SET = new Set<string>(COUNTRY_CODES);

export function isValidCountryCode(code: string | null | undefined): boolean {
  return CODE_SET.has(String(code ?? '').toUpperCase());
}

/** Display name of a stored code through the translated `countries` table; unknown codes show as typed. */
export function countryName(code: string | null | undefined, names: Record<string, string>): string {
  const key = String(code ?? '').toUpperCase();
  return names[key] ?? (code || '');
}
