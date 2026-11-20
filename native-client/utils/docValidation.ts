/**
 * Mirrors backend/pkg/docvalidate (and web/src/lib/docValidation.js): rules
 * keyed by (country, doc type) so the form agrees with the API. A
 * combination with no rule is always valid here.
 */

export const MAX_CARD_NUMBER_LENGTH = 30;

export type DocValidation = { valid: true; normalized?: string } | { valid: false; error: DocValidationError };

/** Keys of `t.documents` holding the message. */
export type DocValidationError = 'ecLength' | 'ecProvince' | 'ecThirdDigit' | 'ecCheckDigit';

function stripEcFormatting(raw: unknown): string {
  return String(raw ?? '').trim().replaceAll(' ', '').replaceAll('-', '');
}

// Exactly 10 digits, province code 01-24 or 30, third digit < 6, modulo-10
// check digit (coefficients 2,1,2,1,2,1,2,1,2; products over 9 subtract 9).
function validateEcNationalId(raw: string): DocValidation {
  const s = stripEcFormatting(raw);
  if (!/^[0-9]{10}$/.test(s)) return { valid: false, error: 'ecLength' };
  const province = parseInt(s.slice(0, 2), 10);
  if (!((province >= 1 && province <= 24) || province === 30)) return { valid: false, error: 'ecProvince' };
  if (Number(s[2]) >= 6) return { valid: false, error: 'ecThirdDigit' };
  const coeffs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let p = Number(s[i]) * coeffs[i];
    if (p > 9) p -= 9;
    sum += p;
  }
  if ((10 - (sum % 10)) % 10 !== Number(s[9])) return { valid: false, error: 'ecCheckDigit' };
  return { valid: true, normalized: s };
}

const REGISTRY: Record<string, (raw: string) => DocValidation> = {
  'EC:national_id': validateEcNationalId,
};

const ruleKey = (countryCode: string | null | undefined, docType: string | null | undefined) =>
  `${(countryCode || '').toUpperCase()}:${docType || ''}`;

export function validateDocument(countryCode: string | null | undefined, docType: string | null | undefined, cardNumber: string): DocValidation {
  const fn = REGISTRY[ruleKey(countryCode, docType)];
  return fn ? fn(cardNumber) : { valid: true };
}

export function hasStrictRule(countryCode: string | null | undefined, docType: string | null | undefined): boolean {
  return Boolean(REGISTRY[ruleKey(countryCode, docType)]);
}

// Ecuadorian cédula: the first two digits are the code of the province where
// it was issued. Names are proper nouns, so they are not translated.
const EC_PROVINCES: Record<string, string> = {
  '01': 'Azuay', '02': 'Bolívar', '03': 'Cañar', '04': 'Carchi', '05': 'Cotopaxi', '06': 'Chimborazo',
  '07': 'El Oro', '08': 'Esmeraldas', '09': 'Guayas', '10': 'Imbabura', '11': 'Loja', '12': 'Los Ríos',
  '13': 'Manabí', '14': 'Morona Santiago', '15': 'Napo', '16': 'Pastaza', '17': 'Pichincha',
  '18': 'Tungurahua', '19': 'Zamora Chinchipe', '20': 'Galápagos', '21': 'Sucumbíos', '22': 'Orellana',
  '23': 'Santo Domingo de los Tsáchilas', '24': 'Santa Elena',
};

/**
 * Issuing province of an Ecuadorian cédula, or null when the document is not
 * an EC national ID or its first two digits are not a province code (30, used
 * for cédulas issued abroad, has no province). Only the prefix is needed, so
 * it also works while the number is being typed.
 */
export function ecCedulaProvince(countryCode: string | null | undefined, docType: string | null | undefined, cardNumber: string | null | undefined): string | null {
  if ((countryCode || '').toUpperCase() !== 'EC' || docType !== 'national_id') return null;
  const s = stripEcFormatting(cardNumber);
  if (!/^[0-9]{2,10}$/.test(s)) return null;
  return EC_PROVINCES[s.slice(0, 2)] ?? null;
}
