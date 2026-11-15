// Mirrors backend/pkg/docvalidate: a registry keyed by (country_code, doc_type)
// so inline form validation matches the API rule exactly. Countries/doc types
// with no rule here keep the same permissive behavior as the backend.

export const MAX_CARD_NUMBER_LENGTH = 30;

function stripECFormatting(raw) {
  return String(raw ?? '').trim().replaceAll(' ', '').replaceAll('-', '');
}

// Exactly 10 digits, province code 01-24 or 30, third digit < 6, modulo-10
// check digit (coefficients 2,1,2,1,2,1,2,1,2; products over 9 subtract 9).
function validateECNationalId(raw) {
  const s = stripECFormatting(raw);
  if (!/^[0-9]{10}$/.test(s)) {
    return { valid: false, error: 'docValidationEcLength' };
  }
  const province = parseInt(s.slice(0, 2), 10);
  if (!((province >= 1 && province <= 24) || province === 30)) {
    return { valid: false, error: 'docValidationEcProvince' };
  }
  const thirdDigit = Number(s[2]);
  if (thirdDigit >= 6) {
    return { valid: false, error: 'docValidationEcThirdDigit' };
  }
  const coeffs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let p = Number(s[i]) * coeffs[i];
    if (p > 9) p -= 9;
    sum += p;
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== Number(s[9])) {
    return { valid: false, error: 'docValidationEcCheckDigit' };
  }
  return { valid: true, normalized: s };
}

const REGISTRY = {
  'EC:national_id': validateECNationalId
};

// Returns { valid: true } or { valid: false, error: <i18n key> }.
// A country/doc-type combination with no registered rule is always valid
// here (only the API applies the generic max-length check server-side).
export function validateDocument(countryCode, docType, cardNumber) {
  const key = `${(countryCode || '').toUpperCase()}:${docType || ''}`;
  const fn = REGISTRY[key];
  if (!fn) return { valid: true };
  return fn(cardNumber);
}

export function hasStrictRule(countryCode, docType) {
  const key = `${(countryCode || '').toUpperCase()}:${docType || ''}`;
  return Boolean(REGISTRY[key]);
}

// Ecuadorian cédula: the first two digits are the code of the province where
// it was issued (01-24). Names are proper nouns, so they are not translated.
const EC_PROVINCES = {
  '01': 'Azuay',
  '02': 'Bolívar',
  '03': 'Cañar',
  '04': 'Carchi',
  '05': 'Cotopaxi',
  '06': 'Chimborazo',
  '07': 'El Oro',
  '08': 'Esmeraldas',
  '09': 'Guayas',
  '10': 'Imbabura',
  '11': 'Loja',
  '12': 'Los Ríos',
  '13': 'Manabí',
  '14': 'Morona Santiago',
  '15': 'Napo',
  '16': 'Pastaza',
  '17': 'Pichincha',
  '18': 'Tungurahua',
  '19': 'Zamora Chinchipe',
  '20': 'Galápagos',
  '21': 'Sucumbíos',
  '22': 'Orellana',
  '23': 'Santo Domingo de los Tsáchilas',
  '24': 'Santa Elena'
};

// The API serializes nullable columns (e.g. country_code) as
// { String, Valid } objects; the detail page passes them through untouched.
function plainText(value) {
  if (value && typeof value === 'object') return value.Valid ? String(value.String ?? '') : '';
  return String(value ?? '');
}

// Returns the issuing province of an Ecuadorian cédula, or null when the
// document is not an EC national ID or its first two digits are not a
// province code (including 30, used for cédulas issued abroad). Only the
// two-digit prefix is needed, so it also works while the number is typed.
export function ecCedulaProvince(countryCode, docType, cardNumber) {
  if (plainText(countryCode).toUpperCase() !== 'EC' || plainText(docType) !== 'national_id') return null;
  const s = stripECFormatting(plainText(cardNumber));
  if (!/^[0-9]{2,10}$/.test(s)) return null;
  return EC_PROVINCES[s.slice(0, 2)] || null;
}
