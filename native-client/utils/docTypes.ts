/**
 * Identity document types, using the codes the backend stores. The label
 * keys point into `t.contactList`.
 */
export const DOCUMENT_TYPES = [
  { value: 'national_id', labelKey: 'docIdCard' },
  { value: 'passport', labelKey: 'docPassport' },
  { value: 'drivers_license', labelKey: 'docDriversLicense' },
  { value: 'residence_permit', labelKey: 'docResidencePermit' },
  { value: 'other', labelKey: 'docOther' },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number]['value'];

export const DEFAULT_DOC_TYPE: DocumentType = 'national_id';

/** Label key for a stored doc_type; unknown values fall back to "other". */
export function docTypeLabelKey(value: string | null | undefined): (typeof DOCUMENT_TYPES)[number]['labelKey'] {
  return (DOCUMENT_TYPES.find(d => d.value === value) ?? DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1]).labelKey;
}
