// Pure module: no react-native / expo imports so it can be unit-tested with node.

/** User-owned tables, ordered children first so FK constraints are never violated. */
export const USER_DATA_TABLES: readonly string[] = [
  'contact_phone',
  'contact_email',
  'national_identity_card',
  'contact_relationship',
  'contact_organization',
  'contact_keyword',
  'contact_note',
  'contact_url',
  'contact_bank_account',
  'organization',
  'contact',
];

/** Seed/lookup tables that must survive a reset. */
export const REFERENCE_TABLES: readonly string[] = ['marital_status', 'relationship_type'];

export function buildLocalDataResetStatements(): string[] {
  return USER_DATA_TABLES.map((table) => `DELETE FROM ${table}`);
}
