import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import schema from '../utils/dbSchema.js';
import { applyChildRow, CHILD_TABLES } from '../utils/syncChildren.ts';

const SQL = await initSqlJs();

/** Minimal async adapter over sql.js matching the `{ getFirstAsync, runAsync }` interface. */
function adapt(raw) {
  return {
    async getFirstAsync(sql, ...params) {
      const stmt = raw.prepare(sql);
      try {
        stmt.bind(params);
        return stmt.step() ? stmt.getAsObject() : null;
      } finally {
        stmt.free();
      }
    },
    async runAsync(sql, ...params) {
      raw.run(sql, params);
    },
  };
}

function makeDb({ legacy = false } = {}) {
  const raw = new SQL.Database();
  raw.exec('PRAGMA foreign_keys = ON');
  if (legacy) {
    raw.exec(`CREATE TABLE contact (contact_id TEXT PRIMARY KEY, first_name TEXT, surname TEXT);
      CREATE TABLE contact_phone (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id TEXT NOT NULL, phone TEXT NOT NULL, label TEXT, updated_at TEXT);
      CREATE TABLE contact_email (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id TEXT NOT NULL, email TEXT NOT NULL, label TEXT, updated_at TEXT);
      CREATE TABLE contact_note (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id TEXT NOT NULL, note TEXT NOT NULL, updated_at TEXT);`);
  } else {
    raw.exec(schema.createTablesSql);
    for (const sql of schema.remoteIdIndexesSql) raw.exec(sql);
  }
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'Ann', 'Lee')");
  return { raw, db: adapt(raw) };
}

function rows(raw, table) {
  const res = raw.exec(`SELECT * FROM ${table} ORDER BY id`);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(v => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
}

const phone = (over = {}) => ({
  phone_id: 'p1', contact_id: 'c1', phone: '555-0001', label: 'mobile', updated_at: 1700000000000, ...over,
});
const apply = (db, row, table = 'contact_phone') => applyChildRow(db, CHILD_TABLES.find(t => t.table === table), row);

test('first pull inserts the row with its remote id', async () => {
  const { raw, db } = makeDb();
  await apply(db, phone());
  const r = rows(raw, 'contact_phone');
  assert.equal(r.length, 1);
  assert.equal(r[0].remote_id, 'p1');
  assert.equal(r[0].phone, '555-0001');
  assert.equal(r[0].label, 'mobile');
  assert.equal(r[0].updated_at, '2023-11-14 22:13:20');
});

test('pulling the same payload twice leaves one row', async () => {
  const { raw, db } = makeDb();
  await apply(db, phone());
  await apply(db, phone());
  assert.equal(rows(raw, 'contact_phone').length, 1);
});

test('a server value edit with the same id updates in place', async () => {
  const { raw, db } = makeDb();
  await apply(db, phone());
  await apply(db, phone({ phone: '555-9999', updated_at: 1700000100000 }));
  const r = rows(raw, 'contact_phone');
  assert.equal(r.length, 1);
  assert.equal(r[0].phone, '555-9999');
  assert.equal(r[0].updated_at, '2023-11-14 22:15:00');
});

test('a label edit updates the label', async () => {
  const { raw, db } = makeDb();
  await apply(db, phone());
  await apply(db, phone({ label: 'work' }));
  const r = rows(raw, 'contact_phone');
  assert.equal(r.length, 1);
  assert.equal(r[0].label, 'work');
});

test('a legacy row without remote id is adopted, not duplicated', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact_phone (contact_id, phone, label) VALUES ('c1', '555-0001', NULL)");
  await apply(db, phone());
  const r = rows(raw, 'contact_phone');
  assert.equal(r.length, 1);
  assert.equal(r[0].remote_id, 'p1');
  assert.equal(r[0].label, 'mobile');
});

test('delete removes the row by remote id', async () => {
  const { raw, db } = makeDb();
  await apply(db, phone());
  await apply(db, phone({ phone: '555-9999' }));
  await apply(db, phone({ phone: '555-9999', deleted: true }));
  assert.equal(rows(raw, 'contact_phone').length, 0);
});

test('delete by remote id works without a value', async () => {
  const { raw, db } = makeDb();
  await apply(db, phone());
  await apply(db, { phone_id: 'p1', contact_id: 'c1', deleted: true });
  assert.equal(rows(raw, 'contact_phone').length, 0);
});

test('delete falls back to the value for legacy rows', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact_phone (contact_id, phone) VALUES ('c1', '555-0001')");
  raw.run("INSERT INTO contact_phone (contact_id, phone, remote_id) VALUES ('c1', '555-0002', 'p2')");
  await apply(db, phone({ deleted: true }));
  const r = rows(raw, 'contact_phone');
  assert.deepEqual(r.map(x => x.phone), ['555-0002']);
});

test('rows whose parent contact is missing are skipped', async () => {
  const { raw, db } = makeDb();
  await apply(db, phone({ contact_id: 'ghost' }));
  assert.equal(rows(raw, 'contact_phone').length, 0);
});

test('NullString labels are unwrapped', async () => {
  const { raw, db } = makeDb();
  await apply(db, phone({ label: { String: 'home', Valid: true } }));
  await apply(db, phone({ phone_id: 'p2', phone: '555-0002', label: { String: '', Valid: false } }));
  const r = rows(raw, 'contact_phone');
  assert.equal(r[0].label, 'home');
  assert.equal(r[1].label, null);
});

test('emails are keyed by email_id', async () => {
  const { raw, db } = makeDb();
  const email = (over = {}) => ({ email_id: 'e1', contact_id: 'c1', email: 'a@x.io', label: 'work', updated_at: 1700000000000, ...over });
  await apply(db, email(), 'contact_email');
  await apply(db, email({ email: 'b@x.io' }), 'contact_email');
  const r = rows(raw, 'contact_email');
  assert.equal(r.length, 1);
  assert.equal(r[0].email, 'b@x.io');
  assert.equal(r[0].remote_id, 'e1');
});

test('notes (no label column) insert, edit and delete by note_id', async () => {
  const { raw, db } = makeDb();
  const note = (over = {}) => ({ note_id: 'n1', contact_id: 'c1', note: 'hello', updated_at: 1700000000000, ...over });
  await apply(db, note(), 'contact_note');
  await apply(db, note({ note: 'hello again' }), 'contact_note');
  let r = rows(raw, 'contact_note');
  assert.equal(r.length, 1);
  assert.equal(r[0].note, 'hello again');
  await apply(db, note({ deleted: true }), 'contact_note');
  r = rows(raw, 'contact_note');
  assert.equal(r.length, 0);
});

test('missing or empty server ids fall back to value matching', async () => {
  const { raw, db } = makeDb();
  await apply(db, phone({ phone_id: undefined }));
  await apply(db, phone({ phone_id: '', label: 'work' }));
  const r = rows(raw, 'contact_phone');
  assert.equal(r.length, 1);
  assert.equal(r[0].remote_id, null);
  assert.equal(r[0].label, 'work');
  await apply(db, phone({ phone_id: '', deleted: true }));
  assert.equal(rows(raw, 'contact_phone').length, 0);
});

test('null remote ids may repeat but a remote id is unique per contact', () => {
  const { raw } = makeDb();
  raw.run("INSERT INTO contact_phone (contact_id, phone) VALUES ('c1', 'a'), ('c1', 'b')");
  raw.run("INSERT INTO contact_phone (contact_id, phone, remote_id) VALUES ('c1', 'a', 'p1')");
  assert.throws(() => raw.run("INSERT INTO contact_phone (contact_id, phone, remote_id) VALUES ('c1', 'z', 'p1')"));
});

test('legacy databases migrate through the dbInit statements and keep their rows', async () => {
  const { raw, db } = makeDb({ legacy: true });
  raw.run("INSERT INTO contact_phone (contact_id, phone) VALUES ('c1', '555-0001')");
  for (const sql of schema.migrationsSql) {
    try { raw.exec(sql); } catch (_) {}
  }
  for (const sql of schema.remoteIdIndexesSql) raw.exec(sql);
  for (const t of ['contact_phone', 'contact_email', 'contact_note']) {
    const cols = raw.exec(`PRAGMA table_info(${t})`)[0].values.map(r => r[1]);
    assert.ok(cols.includes('remote_id'), t);
  }
  // Idempotent when run again (as on every app start).
  for (const sql of schema.migrationsSql) {
    try { raw.exec(sql); } catch (_) {}
  }
  for (const sql of schema.remoteIdIndexesSql) raw.exec(sql);
  await apply(db, phone());
  const r = rows(raw, 'contact_phone');
  assert.equal(r.length, 1);
  assert.equal(r[0].remote_id, 'p1');
  assert.throws(() => raw.run("INSERT INTO contact_phone (contact_id, phone, remote_id) VALUES ('c1', 'z', 'p1')"));
});
