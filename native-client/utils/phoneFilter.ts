import { db } from './db';

/**
 * Returns the set of contact_id that have at least one non-empty phone number
 * in the contact_phone table.
 */
export async function getContactIdsWithPhone(): Promise<Set<string>> {
  try {
    const rows = await db.getAllAsync<{ contact_id: string }>(
      "SELECT DISTINCT contact_id FROM contact_phone WHERE TRIM(phone) <> ''"
    );
    return new Set(rows.map(r => r.contact_id));
  } catch (e) {
    console.error('getContactIdsWithPhone error:', e);
    return new Set();
  }
}
