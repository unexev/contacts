export const DOCUMENT_TYPES = [
  { value: 'national_id', label: 'docTypeNationalId' },
  { value: 'passport', label: 'docTypePassport' },
  { value: 'drivers_license', label: 'docTypeDriversLicense' },
  { value: 'residence_permit', label: 'docTypeResidencePermit' },
  { value: 'other', label: 'docTypeOther' }
];

const LEGACY_DOC_TYPE_MAP = {
  'Cédula': 'national_id',
  'ID Card': 'national_id',
  'Pasaporte': 'passport',
  Passport: 'passport',
  'Licencia de conducir': 'drivers_license'
};

const DOC_TYPE_I18N_KEY = {
  national_id: 'docTypeNationalId',
  passport: 'docTypePassport',
  drivers_license: 'docTypeDriversLicense',
  residence_permit: 'docTypeResidencePermit',
  other: 'docTypeOther'
};

export function normalizeDocType(raw) {
  return LEGACY_DOC_TYPE_MAP[raw] || raw || '';
}

export function docTypeI18nKey(type) {
  return DOC_TYPE_I18N_KEY[type] || DOC_TYPE_I18N_KEY[String(type).toLowerCase()] || null;
}

export function resolveDocTypeLabel(type, t) {
  const key = docTypeI18nKey(type);
  return key ? t(key) : type || 'ID';
}
