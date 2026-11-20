import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import schema from '../utils/dbSchema.js';
import { buildPushBatch, settledSeqs, clearOutbox } from '../utils/syncPush.ts';

const SQL = await initSqlJs();

function adapt(raw) {
  const rowsOf = (sql, params) => {
    const stmt = raw.prepare(sql);
    try {
      stmt.bind(params);
      const out = [];
      while (stmt.step()) out.push(stmt.getAsObject());
      return out;
    } finally { stmt.free(); }
  };
  return {
    async getAllAsync(sql, ...params) { return rowsOf(sql, params); },
    async getFirstAsync(sql, ...params) { return rowsOf(sql, params)[0] ?? null; },
    async runAsync(sql, ...params) { raw.run(sql, params); },
  };
}

function makeDb() {
  const raw = new SQL.Database();
  raw.exec('PRAGMA foreign_keys = ON');
  raw.exec(schema.createTablesSql);
  raw.exec(schema.seedSql);
  raw.exec(schema.outboxSeedSql);
  for (const sql of schema.outboxTriggerStatements()) raw.exec(sql);
  return { raw, db: adapt(raw) };
}

let n = 0;
const ids = () => `id${++n}`;

test('a new contact with children becomes upserts with fresh server ids written back', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, middle_name, surname, birthdate, gender, deceased) VALUES ('c1', 'ANA', 'M', 'LEE', '1990-03-14', 'FEMALE', 1)");
  raw.run("INSERT INTO contact_phone (contact_id, phone, label) VALUES ('c1', '555', 'CASA')");
  raw.run("INSERT INTO national_identity_card (contact_id, doc_type, card_number, issue_date, country_code) VALUES ('c1', 'passport', 'X1', '2020-01-02', 'EC')");
  const batch = await buildPushBatch(db, 100, ids);
  const byEntity = Object.fromEntries(batch.items.map(i => [i.entity, i]));
  assert.deepEqual(byEntity.contact.data, {
    first_name: 'ANA', surname: 'LEE', deceased: true,
    middle_name: { String: 'M', Valid: true }, birthdate: { String: '1990-03-14', Valid: true },
    gender: { String: 'FEMALE', Valid: true }, status_id: { String: '', Valid: false },
    relationship_status: { String: '', Valid: false }, children_count: { Int64: 0, Valid: false },
  });
  assert.equal(byEntity.phone.contact_id, 'c1');
  assert.deepEqual(byEntity.phone.data, { phone: '555', label: { String: 'CASA', Valid: true }, is_active: true });
  assert.equal(byEntity.card.data.country_code.String, 'EC');
  // The ids sent are the ones stored, so the next pull recognises the rows.
  const stored = raw.exec('SELECT remote_id FROM contact_phone')[0].values[0][0];
  assert.equal(stored, byEntity.phone.id);
  // The write-back did not enqueue anything new.
  assert.equal(raw.exec('SELECT count(*) FROM sync_outbox')[0].values[0][0], 3);
});

test('several edits of one row collapse into a single upsert', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'A', 'B')");
  raw.run("UPDATE contact SET first_name = 'C' WHERE contact_id = 'c1'");
  raw.run("UPDATE contact SET first_name = 'D' WHERE contact_id = 'c1'");
  const batch = await buildPushBatch(db, 100, ids);
  assert.equal(batch.items.length, 1);
  assert.equal(batch.items[0].data.first_name, 'D');
  assert.equal(batch.itemSeqs[0].length, 3);
});

test('a row removed before it was sent produces no item', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'A', 'B')");
  raw.run("INSERT INTO contact_note (contact_id, note) VALUES ('c1', 'hi')");
  raw.run('DELETE FROM contact_note');
  const batch = await buildPushBatch(db, 100, ids);
  assert.deepEqual(batch.items.map(i => i.entity), ['contact']);
  assert.equal(batch.idleSeqs.length, 1);
});

test('deleting synced rows sends the server key', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'A', 'B'), ('c2', 'C', 'D')");
  raw.run("INSERT INTO contact_url (contact_id, url, remote_id) VALUES ('c1', 'https://a.b', 'u9')");
  raw.run("INSERT INTO contact_keyword (contact_id, keyword) VALUES ('c1', 'vip')");
  raw.run("INSERT INTO contact_relationship (contact_id, related_contact_id, type_id) VALUES ('c1', 'c2', 'hermano')");
  raw.run('DELETE FROM sync_outbox');
  raw.run('DELETE FROM contact_url');
  raw.run('DELETE FROM contact_keyword');
  raw.run('DELETE FROM contact_relationship');
  raw.run("DELETE FROM contact WHERE contact_id = 'c2'");
  const batch = await buildPushBatch(db, 100, ids);
  assert.deepEqual(batch.items, [
    { entity: 'url', op: 'delete', id: 'u9', contact_id: 'c1' },
    { entity: 'keyword', op: 'delete', id: 'vip', contact_id: 'c1' },
    { entity: 'relationship', op: 'delete', id: 'c2', contact_id: 'c1', data: { type_id: 'hermano' } },
    { entity: 'contact', op: 'delete', id: 'c2', contact_id: 'c2' },
  ]);
});

test('relationships, keywords and organization links carry their natural keys', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'A', 'B'), ('c2', 'C', 'D')");
  raw.run("INSERT INTO organization (organization_id, name) VALUES ('o1', 'ACME')");
  raw.run("INSERT INTO contact_organization (contact_id, organization_id, achievement, date) VALUES ('c1', 'o1', 'CEO', '2019-05-06')");
  raw.run("INSERT INTO contact_keyword (contact_id, keyword) VALUES ('c1', 'vip')");
  raw.run("INSERT INTO contact_relationship (contact_id, related_contact_id, type_id) VALUES ('c1', 'c2', 'hermano')");
  const items = (await buildPushBatch(db, 100, ids)).items;
  const get = (e) => items.find(i => i.entity === e);
  assert.deepEqual(get('organization'), { entity: 'organization', op: 'upsert', id: 'o1', data: { name: 'ACME' } });
  assert.deepEqual(get('contact_organization').data, { organization_id: 'o1', achievement: { String: 'CEO', Valid: true }, date: { String: '2019-05-06', Valid: true } });
  assert.equal(get('keyword').id, 'vip');
  assert.deepEqual(get('relationship').data, { related_contact_id: 'c2', type_id: 'hermano' });
});

test('items the server failed on stay queued, the rest are cleared', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'A', 'B')");
  raw.run("INSERT INTO contact_note (contact_id, note) VALUES ('c1', 'hi')");
  const batch = await buildPushBatch(db, 100, ids);
  const results = batch.items.map((_, index) => ({ index, status: index === 1 ? 'error' : 'applied', http_status: index === 1 ? 500 : 200 }));
  await clearOutbox(db, settledSeqs(batch, results));
  const left = raw.exec('SELECT entity FROM sync_outbox')[0].values.map(v => v[0]);
  assert.deepEqual(left, ['note']);
});

test('backfill queues local rows that were never synced', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'A', 'B')");
  raw.run("INSERT INTO contact_phone (contact_id, phone, remote_id) VALUES ('c1', '1', 'p1')");
  raw.run("INSERT INTO contact_phone (contact_id, phone) VALUES ('c1', '2')");
  raw.run('DELETE FROM sync_outbox');
  for (const sql of schema.outboxBackfillStatements()) raw.exec(sql);
  const entities = raw.exec('SELECT entity FROM sync_outbox ORDER BY seq')[0].values.map(v => v[0]);
  assert.deepEqual(entities, ['contact', 'phone']);
});

test('locations and nationalities are pushed in the shapes the server reads', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'A', 'B')");
  raw.run("INSERT INTO contact_location (contact_id, location_type, address, city, latitude, longitude) VALUES ('c1', 'birth', 'Calle 1', 'Quito', -0.18, -78.47)");
  raw.run("INSERT INTO contact_nationality (contact_id, country_code, acquired_at, note) VALUES ('c1', 'EC', '2001-02-03', NULL)");
  const batch = await buildPushBatch(db, 100, ids);
  const byEntity = Object.fromEntries(batch.items.map(i => [i.entity, i]));
  assert.deepEqual(byEntity.location.data, {
    location_type: 'birth', address: 'Calle 1', city: 'Quito', region: '', country: '', postal_code: '',
    latitude: -0.18, longitude: -78.47,
  });
  assert.equal(byEntity.location.contact_id, 'c1');
  assert.deepEqual(byEntity.nationality.data, {
    country_code: 'EC', acquired_at: { String: '2001-02-03', Valid: true }, note: { String: '', Valid: false },
  });
  assert.equal(raw.exec('SELECT remote_id FROM contact_nationality')[0].values[0][0], byEntity.nationality.id);
});

test('deleting a synced location or nationality pushes a delete with its server id', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'A', 'B')");
  raw.run("INSERT INTO contact_location (contact_id, location_type, city, remote_id) VALUES ('c1', 'work', 'Quito', 'l9')");
  raw.run("INSERT INTO contact_nationality (contact_id, country_code, remote_id) VALUES ('c1', 'EC', 'n9')");
  raw.run('DELETE FROM sync_outbox');
  raw.run("DELETE FROM contact_location WHERE remote_id = 'l9'");
  raw.run("DELETE FROM contact_nationality WHERE remote_id = 'n9'");
  const batch = await buildPushBatch(db, 100, ids);
  assert.deepEqual(batch.items.map(i => [i.entity, i.op, i.id, i.contact_id]).sort(),
    [['location', 'delete', 'l9', 'c1'], ['nationality', 'delete', 'n9', 'c1']]);
});
