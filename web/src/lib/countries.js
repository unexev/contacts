export const COUNTRIES = [
  { value: 'EC', label: 'countryEC' },
  { value: 'AR', label: 'countryAR' },
  { value: 'BO', label: 'countryBO' },
  { value: 'BR', label: 'countryBR' },
  { value: 'CL', label: 'countryCL' },
  { value: 'CO', label: 'countryCO' },
  { value: 'PE', label: 'countryPE' },
  { value: 'VE', label: 'countryVE' },
  { value: 'UY', label: 'countryUY' },
  { value: 'PY', label: 'countryPY' },
  { value: 'MX', label: 'countryMX' },
  { value: 'US', label: 'countryUS' },
  { value: 'CA', label: 'countryCA' },
  { value: 'ES', label: 'countryES' },
  { value: 'IT', label: 'countryIT' },
  { value: 'FR', label: 'countryFR' },
  { value: 'DE', label: 'countryDE' },
  { value: 'PT', label: 'countryPT' },
  { value: 'GB', label: 'countryGB' },
  { value: 'CN', label: 'countryCN' },
  { value: 'JP', label: 'countryJP' },
  { value: 'KR', label: 'countryKR' },
  { value: 'IN', label: 'countryIN' },
  { value: 'RU', label: 'countryRU' },
  { value: 'AU', label: 'countryAU' },
  { value: 'OTHER', label: 'countryOTHER' }
];

const COUNTRY_LABEL_MAP = Object.fromEntries(COUNTRIES.map(c => [c.value, c.label]));
const COUNTRY_CODE_SET = new Set(COUNTRIES.map(c => c.value));

export function isValidCountryCode(code) {
  return COUNTRY_CODE_SET.has(String(code).toUpperCase());
}

export function countryLabelKey(code) {
  return COUNTRY_LABEL_MAP[String(code).toUpperCase()] || null;
}

export function resolveCountryLabel(code, t) {
  const key = countryLabelKey(code);
  return key ? t(key) : code || '—';
}
