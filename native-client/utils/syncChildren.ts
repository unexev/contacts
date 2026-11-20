/**
 * Applies pulled phone/email/note rows to the local database, keyed by the server id
 * (`remote_id`). No react-native / expo imports so it can run under `node --test`.
 */
// The explicit extension lets `node --test` resolve this file; tsconfig does not allow it.
// @ts-ignore TS5097
import { msToSqliteDatetime, nullStringValue } from "./syncMapping.ts";
// @ts-ignore TS5097
import { toIsoDate } from "./dates.ts";

export interface ChildDb {
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
}

export interface ChildTable {
  table: string;
  /** Value column in the local table and in the pulled row. */
  column: string;
  /** Server id key in the pulled row. */
  idKey: string;
  hasLabel: boolean;
  /** Further columns copied from the pulled row (already in the local format). */
  extras?: { column: string; read: (row: Record<string, any>) => unknown }[];
  /** Rows without a usable main value (locations may only have a city): decides if a pulled row is kept. */
  hasContent?: (row: Record<string, any>) => boolean;
  /** False when the main value says nothing about identity, so rows are matched by server id only. */
  matchByValue?: boolean;
}

const text = (key: string) => (row: Record<string, any>) => nullStringValue(row[key]);
const date = (key: string) => (row: Record<string, any>) => toIsoDate(nullStringValue(row[key]));

const num = (key: string) => (row: Record<string, any>) => {
  const n = row[key];
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

export const CHILD_TABLES: ChildTable[] = [
  {
    table: "contact_phone", column: "phone", idKey: "phone_id", hasLabel: true,
    extras: [{ column: "is_active", read: (row) => (row.is_active === false ? 0 : 1) }],
  },
  { table: "contact_email", column: "email", idKey: "email_id", hasLabel: true },
  { table: "contact_note", column: "note", idKey: "note_id", hasLabel: false },
  { table: "contact_url", column: "url", idKey: "url_id", hasLabel: true },
  {
    table: "national_identity_card", column: "card_number", idKey: "card_id", hasLabel: false,
    extras: [
      { column: "doc_type", read: (row) => row.doc_type || "other" },
      { column: "issue_date", read: date("issue_date") },
      { column: "expiry_date", read: date("expiry_date") },
      { column: "country_code", read: text("country_code") },
    ],
  },
  {
    table: "contact_bank_account", column: "account_number", idKey: "bank_account_id", hasLabel: true,
    extras: [
      { column: "bank_name", read: text("bank_name") },
      { column: "account_type", read: text("account_type") },
    ],
  },
  {
    table: "contact_nationality", column: "country_code", idKey: "nationality_id", hasLabel: false,
    extras: [
      { column: "acquired_at", read: date("acquired_at") },
      { column: "note", read: text("note") },
    ],
  },
  {
    table: "contact_location", column: "location_type", idKey: "location_id", hasLabel: false, matchByValue: false,
    hasContent: (row) => ["address", "city", "region", "country", "postal_code"].some((k) => String(row[k] ?? "").trim() !== ""),
    extras: [
      { column: "address", read: text("address") },
      { column: "city", read: text("city") },
      { column: "region", read: text("region") },
      { column: "country", read: text("country") },
      { column: "postal_code", read: text("postal_code") },
      { column: "latitude", read: num("latitude") },
      { column: "longitude", read: num("longitude") },
    ],
  },
];

type PulledRow = Record<string, any>;

function remoteIdOf(row: PulledRow, idKey: string): string | null {
  const id = row[idKey];
  if (id === undefined || id === null) return null;
  const text = String(id);
  return text === "" ? null : text;
}

async function applyDelete(db: ChildDb, t: ChildTable, row: PulledRow, remoteId: string | null) {
  if (remoteId) {
    const found = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM ${t.table} WHERE contact_id = ? AND remote_id = ?`,
      row.contact_id,
      remoteId,
    );
    if (found) {
      await db.runAsync(`DELETE FROM ${t.table} WHERE id = ?`, found.id);
      return;
    }
  }
  // Legacy rows were never tagged with a remote id: match them by value.
  const value = row[t.column];
  if (!value || t.matchByValue === false) return;
  await db.runAsync(
    `DELETE FROM ${t.table} WHERE contact_id = ? AND ${t.column} = ? AND remote_id IS NULL`,
    row.contact_id,
    value,
  );
}

/** Applies one pulled child row (insert, update, adopt a legacy row, or delete). */
export async function applyChildRow(db: ChildDb, t: ChildTable, row: PulledRow): Promise<void> {
  const remoteId = remoteIdOf(row, t.idKey);
  if (row.deleted) {
    await applyDelete(db, t, row, remoteId);
    return;
  }
  const value = row[t.column] ?? "";
  if (t.hasContent ? !t.hasContent(row) : !value) return;
  // Rows whose parent contact is missing locally would violate the FK.
  if (!(await db.getFirstAsync("SELECT 1 FROM contact WHERE contact_id = ?", row.contact_id))) return;

  const updatedAt = msToSqliteDatetime(row.updated_at);
  const label = t.hasLabel ? nullStringValue(row.label) : null;
  const extras = t.extras ?? [];

  let target: { id: number } | null = null;
  if (remoteId) {
    target = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM ${t.table} WHERE contact_id = ? AND remote_id = ?`,
      row.contact_id,
      remoteId,
    );
  }
  // Adopt a legacy row (or, without a server id, the matching row) by value.
  if (!target && t.matchByValue !== false) {
    target = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM ${t.table} WHERE contact_id = ? AND ${t.column} = ? AND remote_id IS NULL`,
      row.contact_id,
      value,
    );
  }

  if (target) {
    const labelSet = t.hasLabel ? ", label = ?" : "";
    const extraSet = extras.map((e) => `, ${e.column} = ?`).join("");
    const params: unknown[] = [value, remoteId, updatedAt];
    if (t.hasLabel) params.push(label);
    for (const e of extras) params.push(e.read(row));
    await db.runAsync(
      `UPDATE ${t.table} SET ${t.column} = ?, remote_id = ?, updated_at = COALESCE(?, datetime('now'))${labelSet}${extraSet} WHERE id = ?`,
      ...params,
      target.id,
    );
    return;
  }

  const labelColumn = t.hasLabel ? ", label" : "";
  const labelMark = t.hasLabel ? ", ?" : "";
  const extraColumns = extras.map((e) => `, ${e.column}`).join("");
  const extraMarks = extras.map(() => ", ?").join("");
  const params: unknown[] = [row.contact_id, value, remoteId, updatedAt];
  if (t.hasLabel) params.push(label);
  for (const e of extras) params.push(e.read(row));
  await db.runAsync(
    `INSERT INTO ${t.table} (contact_id, ${t.column}, remote_id, updated_at${labelColumn}${extraColumns}) VALUES (?, ?, ?, COALESCE(?, datetime('now'))${labelMark}${extraMarks})`,
    ...params,
  );
}
