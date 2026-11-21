/**
 * Applies a pulled /api/sync payload to the local database. Pure of
 * react-native / expo imports so it runs under `node --test`.
 *
 * The caller owns the transaction. While applying, `sync_state.applying` is 1
 * so the outbox triggers do not echo server changes back as local edits.
 */
// The explicit extension lets `node --test` resolve these files; tsconfig does not allow it.
// @ts-ignore TS5097
import { applyChildRow, CHILD_TABLES, type ChildDb } from "./syncChildren.ts";
// @ts-ignore TS5097
import { mapContactRow, msToSqliteDatetime, nullStringValue } from "./syncMapping.ts";
// @ts-ignore TS5097
import { toIsoDate } from "./dates.ts";

type Row = Record<string, any>;

export interface PulledChanges {
  contacts?: Row[];
  phones?: Row[];
  emails?: Row[];
  urls?: Row[];
  notes?: Row[];
  keywords?: Row[];
  identity_cards?: Row[];
  bank_accounts?: Row[];
  relationships?: Row[];
  organizations?: Row[];
  contact_organizations?: Row[];
  locations?: Row[];
  nationalities?: Row[];
}

/** Child tables of a contact, emptied when the contact is deleted. */
const CONTACT_CHILD_TABLES = [
  "contact_phone", "contact_email", "contact_note", "contact_url", "contact_keyword",
  "national_identity_card", "contact_bank_account", "contact_organization", "contact_location", "contact_nationality",
];

const PULLED_BY_TABLE: Record<string, keyof PulledChanges> = {
  contact_phone: "phones",
  contact_email: "emails",
  contact_note: "notes",
  contact_url: "urls",
  national_identity_card: "identity_cards",
  contact_bank_account: "bank_accounts",
  contact_location: "locations",
  contact_nationality: "nationalities",
};

async function contactExists(db: ChildDb, id: string): Promise<boolean> {
  return !!(await db.getFirstAsync("SELECT 1 FROM contact WHERE contact_id = ?", id));
}

async function applyContact(db: ChildDb, c: Row) {
  if (c.deleted) {
    await db.runAsync("DELETE FROM contact_relationship WHERE contact_id = ? OR related_contact_id = ?", c.contact_id, c.contact_id);
    for (const table of CONTACT_CHILD_TABLES) {
      await db.runAsync(`DELETE FROM ${table} WHERE contact_id = ?`, c.contact_id);
    }
    await db.runAsync("DELETE FROM contact WHERE contact_id = ?", c.contact_id);
    return;
  }
  const r = mapContactRow(c as any);
  await db.runAsync(
    `INSERT INTO contact (contact_id, first_name, middle_name, surname, birthdate, gender, status_id,
       relationship_status, children_count, deceased, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))
     ON CONFLICT(contact_id) DO UPDATE SET
       first_name = excluded.first_name, middle_name = excluded.middle_name, surname = excluded.surname,
       birthdate = excluded.birthdate, gender = excluded.gender, status_id = excluded.status_id,
       relationship_status = excluded.relationship_status, children_count = excluded.children_count,
       deceased = excluded.deceased, updated_at = excluded.updated_at,
       created_at = COALESCE(?, contact.created_at)`,
    r.contact_id, r.first_name, r.middle_name, r.surname, r.birthdate, r.gender, r.status_id,
    r.relationship_status, r.children_count, r.deceased, r.updated_at, r.created_at, r.created_at,
  );
}

async function applyOrganization(db: ChildDb, o: Row) {
  if (o.deleted) {
    // Keep it while a local link still points at it (the link is removed by its own delete).
    await db.runAsync(
      "DELETE FROM organization WHERE organization_id = ? AND NOT EXISTS (SELECT 1 FROM contact_organization WHERE organization_id = ?)",
      o.organization_id, o.organization_id,
    );
    return;
  }
  const name = String(o.name ?? "").trim();
  if (!name) return;
  // The same organization may exist locally under another id (names are unique):
  // adopt the server id and repoint the links.
  const sameName = await db.getFirstAsync<{ organization_id: string }>(
    "SELECT organization_id FROM organization WHERE name = ? AND organization_id <> ?", name, o.organization_id,
  );
  if (sameName) {
    // Names are unique: free the name, create the server's row, move the links, drop the old row.
    await db.runAsync("UPDATE organization SET name = name || ' #' || organization_id WHERE organization_id = ?", sameName.organization_id);
    await db.runAsync("INSERT OR IGNORE INTO organization (organization_id, name) VALUES (?, ?)", o.organization_id, name);
    await db.runAsync("UPDATE contact_organization SET organization_id = ? WHERE organization_id = ?", o.organization_id, sameName.organization_id);
    await db.runAsync("DELETE FROM organization WHERE organization_id = ?", sameName.organization_id);
  }
  await db.runAsync(
    "INSERT INTO organization (organization_id, name) VALUES (?, ?) ON CONFLICT(organization_id) DO UPDATE SET name = excluded.name",
    o.organization_id, name,
  );
}

async function applyKeyword(db: ChildDb, k: Row) {
  if (!k.keyword) return;
  if (k.deleted) {
    await db.runAsync("DELETE FROM contact_keyword WHERE contact_id = ? AND keyword = ?", k.contact_id, k.keyword);
    return;
  }
  if (!(await contactExists(db, k.contact_id))) return;
  await db.runAsync("INSERT OR IGNORE INTO contact_keyword (contact_id, keyword) VALUES (?, ?)", k.contact_id, k.keyword);
}

async function applyRelationship(db: ChildDb, r: Row) {
  if (!r.related_contact_id || !r.type_id) return;
  if (r.deleted) {
    await db.runAsync(
      "DELETE FROM contact_relationship WHERE contact_id = ? AND related_contact_id = ? AND type_id = ?",
      r.contact_id, r.related_contact_id, r.type_id,
    );
    return;
  }
  const updatedAt = msToSqliteDatetime(r.updated_at);
  // Both contacts and the type must exist locally (foreign keys).
  const ok = (await contactExists(db, r.contact_id)) && (await contactExists(db, r.related_contact_id))
    && !!(await db.getFirstAsync("SELECT 1 FROM relationship_type WHERE type_id = ?", r.type_id));
  if (!ok) return;
  await db.runAsync(
    "INSERT OR IGNORE INTO contact_relationship (contact_id, related_contact_id, type_id, updated_at) VALUES (?, ?, ?, COALESCE(?, datetime('now')))",
    r.contact_id, r.related_contact_id, r.type_id, updatedAt,
  );
}

async function applyContactOrganization(db: ChildDb, o: Row) {
  if (!o.organization_id) return;
  if (o.deleted) {
    await db.runAsync("DELETE FROM contact_organization WHERE contact_id = ? AND organization_id = ?", o.contact_id, o.organization_id);
    return;
  }
  if (!(await contactExists(db, o.contact_id))) return;
  // The link row may arrive without its organization row (renamed on the server): create a stub.
  if (!(await db.getFirstAsync("SELECT 1 FROM organization WHERE organization_id = ?", o.organization_id))) {
    const name = String(o.organization_name ?? "").trim();
    if (!name) return;
    await applyOrganization(db, { organization_id: o.organization_id, name });
  }
  const achievement = nullStringValue(o.achievement) ?? "";
  const when = toIsoDate(nullStringValue(o.date));
  const updatedAt = msToSqliteDatetime(o.updated_at);
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM contact_organization WHERE contact_id = ? AND organization_id = ?", o.contact_id, o.organization_id,
  );
  if (existing) {
    await db.runAsync(
      "UPDATE contact_organization SET achievement = ?, date = ?, updated_at = COALESCE(?, datetime('now')) WHERE id = ?",
      achievement, when, updatedAt, existing.id,
    );
  } else {
    await db.runAsync(
      "INSERT INTO contact_organization (contact_id, organization_id, achievement, date, updated_at) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))",
      o.contact_id, o.organization_id, achievement, when, updatedAt,
    );
  }
}

/** Applies every pulled table, parents first, with outbox tracking muted. */
export async function applyPulledChanges(db: ChildDb, changes: PulledChanges): Promise<void> {
  await db.runAsync("UPDATE sync_state SET v = 1 WHERE k = 'applying'");
  try {
    for (const o of changes.organizations ?? []) await applyOrganization(db, o);
    for (const c of changes.contacts ?? []) await applyContact(db, c);
    for (const t of CHILD_TABLES) {
      for (const row of changes[PULLED_BY_TABLE[t.table]] ?? []) await applyChildRow(db, t, row);
    }
    for (const k of changes.keywords ?? []) await applyKeyword(db, k);
    for (const r of changes.relationships ?? []) await applyRelationship(db, r);
    for (const o of changes.contact_organizations ?? []) await applyContactOrganization(db, o);
  } finally {
    await db.runAsync("UPDATE sync_state SET v = 0 WHERE k = 'applying'");
  }
}

/** True when the payload carries any row. */
export function hasPulledRows(changes: PulledChanges): boolean {
  return Object.values(changes).some((rows) => Array.isArray(rows) && rows.length > 0);
}
