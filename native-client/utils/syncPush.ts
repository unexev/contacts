/**
 * Turns the local change log (`sync_outbox`) into /api/sync/push items.
 * Pure of react-native / expo imports so it runs under `node --test`.
 */
// The explicit extension lets `node --test` resolve these files; tsconfig does not allow it.
// @ts-ignore TS5097
import { contactPushNullFields, sqliteDatetimeToMs, toNullString } from "./syncMapping.ts";
// @ts-ignore TS5097
import { toIsoDate } from "./dates.ts";

type Row = Record<string, any>;

export interface PushDb {
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
}

export interface PushItem {
  entity: string;
  op: "upsert" | "delete";
  id: string;
  contact_id?: string;
  data?: unknown;
}

export interface PushBatch {
  items: PushItem[];
  /** Outbox rows covered by each item, same order as `items`. */
  itemSeqs: number[][];
  /** Outbox rows that produce no item (the row vanished before it was sent). */
  idleSeqs: number[];
}

interface OutboxRow {
  seq: number;
  entity: string;
  local_key: string;
  remote_key: string | null;
  contact_id: string | null;
  op: "upsert" | "delete";
}

/** Entities stored under a local integer id plus a server `remote_id`. */
const ID_TABLES: Record<string, string> = {
  phone: "contact_phone",
  email: "contact_email",
  note: "contact_note",
  url: "contact_url",
  card: "national_identity_card",
  bank_account: "contact_bank_account",
  location: "contact_location",
  nationality: "contact_nationality",
};

export const PUSH_BATCH_LIMIT = 100;

/** A fresh server id for a row created on this device. */
export function newRemoteId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const ns = toNullString;

function dataFor(entity: string, row: Row): unknown {
  switch (entity) {
    case "contact":
      return {
        first_name: row.first_name,
        surname: row.surname,
        deceased: !!row.deceased,
        // The server keeps the first value it sees, so offline-created contacts keep their real creation time.
        ...(sqliteDatetimeToMs(row.created_at as string) ? { created_at: sqliteDatetimeToMs(row.created_at as string) } : {}),
        ...contactPushNullFields(row as any),
      };
    case "phone":
      return { phone: row.phone, label: ns(row.label), is_active: row.is_active !== 0 };
    case "email":
      return { email: row.email, label: ns(row.label) };
    case "url":
      return { url: row.url, label: ns(row.label) };
    case "note":
      return { note: row.note };
    case "card":
      return {
        doc_type: row.doc_type,
        card_number: row.card_number,
        issue_date: ns(toIsoDate(row.issue_date)),
        expiry_date: ns(toIsoDate(row.expiry_date)),
        country_code: ns(row.country_code),
      };
    case "bank_account":
      return {
        bank_name: ns(row.bank_name),
        account_number: row.account_number,
        account_type: ns(row.account_type),
        label: ns(row.label),
      };
    case "location":
      return {
        location_type: row.location_type ?? "",
        address: row.address ?? "",
        city: row.city ?? "",
        region: row.region ?? "",
        country: row.country ?? "",
        postal_code: row.postal_code ?? "",
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
      };
    case "nationality":
      return { country_code: row.country_code, acquired_at: ns(toIsoDate(row.acquired_at)), note: ns(row.note) };
    case "contact_organization":
      return { organization_id: row.organization_id, achievement: ns(row.achievement), date: ns(toIsoDate(row.date)) };
    case "organization":
      return { name: row.name };
    default:
      return {};
  }
}

async function loadRow(db: PushDb, o: OutboxRow): Promise<Row | null> {
  if (o.entity === "contact") return db.getFirstAsync("SELECT * FROM contact WHERE contact_id = ?", o.local_key);
  if (o.entity === "organization") return db.getFirstAsync("SELECT * FROM organization WHERE organization_id = ?", o.local_key);
  if (o.entity === "keyword") {
    return db.getFirstAsync("SELECT keyword FROM contact_keyword WHERE contact_id = ? AND keyword = ?", o.contact_id, o.local_key);
  }
  if (o.entity === "relationship") {
    const [related, type] = o.local_key.split("|");
    return db.getFirstAsync(
      "SELECT related_contact_id, type_id FROM contact_relationship WHERE contact_id = ? AND related_contact_id = ? AND type_id = ?",
      o.contact_id, related, type,
    );
  }
  if (o.entity === "contact_organization") {
    return db.getFirstAsync("SELECT * FROM contact_organization WHERE contact_id = ? AND organization_id = ?", o.contact_id, o.local_key);
  }
  const table = ID_TABLES[o.entity];
  return table ? db.getFirstAsync(`SELECT * FROM ${table} WHERE id = ?`, Number(o.local_key)) : null;
}

async function ensureRemoteId(db: PushDb, table: string, row: Row, makeId: () => string): Promise<string> {
  if (row.remote_id) return String(row.remote_id);
  const id = makeId();
  // Writing the id back is not a user edit: keep the triggers quiet.
  await db.runAsync("UPDATE sync_state SET v = 1 WHERE k = 'applying'");
  try {
    await db.runAsync(`UPDATE ${table} SET remote_id = ? WHERE id = ?`, id, row.id);
  } finally {
    await db.runAsync("UPDATE sync_state SET v = 0 WHERE k = 'applying'");
  }
  return id;
}

/** Builds the next batch from the outbox. Repeated changes to one row collapse into the last one. */
export async function buildPushBatch(
  db: PushDb,
  limit: number = PUSH_BATCH_LIMIT,
  makeId: () => string = newRemoteId,
): Promise<PushBatch> {
  const rows = await db.getAllAsync<OutboxRow>(
    "SELECT seq, entity, local_key, remote_key, contact_id, op FROM sync_outbox ORDER BY seq LIMIT ?",
    limit * 5,
  );

  const groups = new Map<string, { last: OutboxRow; seqs: number[] }>();
  for (const r of rows) {
    const key = `${r.entity}\u0000${r.contact_id ?? ""}\u0000${r.local_key}`;
    const g = groups.get(key);
    if (g) {
      g.last = r;
      g.seqs.push(r.seq);
    } else {
      groups.set(key, { last: r, seqs: [r.seq] });
    }
  }

  const batch: PushBatch = { items: [], itemSeqs: [], idleSeqs: [] };
  for (const { last, seqs } of groups.values()) {
    if (batch.items.length >= limit) break;

    if (last.op === "delete") {
      const id = last.remote_key ?? last.local_key;
      if (!id) {
        batch.idleSeqs.push(...seqs);
        continue;
      }
      const item: PushItem = { entity: last.entity, op: "delete", id, ...(last.contact_id ? { contact_id: last.contact_id } : {}) };
      if (last.entity === "relationship") item.data = { type_id: last.local_key.split("|")[1] };
      batch.items.push(item);
      batch.itemSeqs.push(seqs);
      continue;
    }

    const row = await loadRow(db, last);
    if (!row) {
      batch.idleSeqs.push(...seqs);
      continue;
    }
    let id: string;
    if (ID_TABLES[last.entity]) id = await ensureRemoteId(db, ID_TABLES[last.entity], row, makeId);
    else if (last.entity === "relationship") id = row.related_contact_id;
    else if (last.entity === "keyword") id = row.keyword;
    else id = last.local_key;

    const data = last.entity === "relationship"
      ? { related_contact_id: row.related_contact_id, type_id: row.type_id }
      : last.entity === "keyword" ? {} : dataFor(last.entity, row);
    batch.items.push({ entity: last.entity, op: "upsert", id, ...(last.contact_id ? { contact_id: last.contact_id } : {}), data });
    batch.itemSeqs.push(seqs);
  }
  return batch;
}

export interface PushResult {
  index: number;
  status: string;
  http_status: number;
}

/** Outbox rows to drop after a push: everything except items the server failed on (they are retried). */
export function settledSeqs(batch: PushBatch, results: PushResult[]): number[] {
  const byIndex = new Map(results.map((r) => [r.index, r]));
  const settled = [...batch.idleSeqs];
  batch.itemSeqs.forEach((seqs, i) => {
    const r = byIndex.get(i);
    if (r && r.status === "error") return;
    settled.push(...seqs);
  });
  return settled;
}

export async function clearOutbox(db: PushDb, seqs: number[]): Promise<void> {
  for (let i = 0; i < seqs.length; i += 200) {
    const chunk = seqs.slice(i, i + 200);
    await db.runAsync(`DELETE FROM sync_outbox WHERE seq IN (${chunk.map(() => "?").join(",")})`, ...chunk);
  }
}
