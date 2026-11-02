/**
 * Applies pulled phone/email/note rows to the local database, keyed by the server id
 * (`remote_id`). No react-native / expo imports so it can run under `node --test`.
 */
// The explicit extension lets `node --test` resolve this file; tsconfig does not allow it.
// @ts-ignore TS5097
import { msToSqliteDatetime, nullStringValue } from "./syncMapping.ts";

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
}

export const CHILD_TABLES: ChildTable[] = [
  { table: "contact_phone", column: "phone", idKey: "phone_id", hasLabel: true },
  { table: "contact_email", column: "email", idKey: "email_id", hasLabel: true },
  { table: "contact_note", column: "note", idKey: "note_id", hasLabel: false },
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
  if (!value) return;
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
  const value = row[t.column];
  if (!value) return;
  // Rows whose parent contact is missing locally would violate the FK.
  if (!(await db.getFirstAsync("SELECT 1 FROM contact WHERE contact_id = ?", row.contact_id))) return;

  const updatedAt = msToSqliteDatetime(row.updated_at);
  const label = t.hasLabel ? nullStringValue(row.label) : null;

  let target: { id: number } | null = null;
  if (remoteId) {
    target = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM ${t.table} WHERE contact_id = ? AND remote_id = ?`,
      row.contact_id,
      remoteId,
    );
  }
  // Adopt a legacy row (or, without a server id, the matching row) by value.
  if (!target) {
    target = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM ${t.table} WHERE contact_id = ? AND ${t.column} = ? AND remote_id IS NULL`,
      row.contact_id,
      value,
    );
  }

  if (target) {
    const labelSet = t.hasLabel ? ", label = ?" : "";
    const params: unknown[] = [value, remoteId, updatedAt];
    if (t.hasLabel) params.push(label);
    await db.runAsync(
      `UPDATE ${t.table} SET ${t.column} = ?, remote_id = ?, updated_at = COALESCE(?, datetime('now'))${labelSet} WHERE id = ?`,
      ...params,
      target.id,
    );
    return;
  }

  const labelColumn = t.hasLabel ? ", label" : "";
  const labelMark = t.hasLabel ? ", ?" : "";
  const params: unknown[] = [row.contact_id, value, remoteId, updatedAt];
  if (t.hasLabel) params.push(label);
  await db.runAsync(
    `INSERT INTO ${t.table} (contact_id, ${t.column}, remote_id, updated_at${labelColumn}) VALUES (?, ?, ?, COALESCE(?, datetime('now'))${labelMark})`,
    ...params,
  );
}
