import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import schema from '../utils/dbSchema.js';

const SQL = await initSqlJs();

function makeDb() {
  const db = new SQL.Database();
  db.exec(schema.createTablesSql);
  for (const sql of schema.migrationsSql) { try { db.exec(sql); } catch (_) {} }
  db.exec(schema.seedSql);
  db.exec(schema.outboxSeedSql);
  for (const sql of schema.outboxTriggerStatements()) db.exec(sql);
  db.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'Ann', 'Lee')");
  db.run('DELETE FROM sync_outbox');
  return db;
}

const outbox = (db) => {
  const res = db.exec('SELECT entity, local_key, remote_key, contact_id, op FROM sync_outbox ORDER BY seq');
  return res.length ? res[0].values.map(v => v.join(',')) : [];
};

test('inserts and updates are recorded as upserts', () => {
  const db = makeDb();
  db.run("INSERT INTO contact_phone (contact_id, phone) VALUES ('c1', '555')");
  db.run("UPDATE contact_phone SET phone = '556' WHERE id = 1");
  assert.deepEqual(outbox(db), ['phone,1,,c1,upsert', 'phone,1,,c1,upsert']);
});

test('deleting a row that never reached the server records nothing', () => {
  const db = makeDb();
  db.run("INSERT INTO contact_email (contact_id, email) VALUES ('c1', 'a@b.c')");
  db.run('DELETE FROM sync_outbox');
  db.run('DELETE FROM contact_email');
  assert.deepEqual(outbox(db), []);
});

test('deleting a synced row records its server id', () => {
  const db = makeDb();
  db.run("INSERT INTO contact_email (contact_id, email, remote_id) VALUES ('c1', 'a@b.c', 'e9')");
  db.run('DELETE FROM sync_outbox');
  db.run('DELETE FROM contact_email');
  assert.deepEqual(outbox(db), ['email,1,e9,c1,delete']);
});

test('keywords and relationships are keyed by their natural keys', () => {
  const db = makeDb();
  db.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c2', 'Bob', 'Ray')");
  db.run('DELETE FROM sync_outbox');
  db.run("INSERT INTO contact_keyword (contact_id, keyword) VALUES ('c1', 'vip')");
  db.run("INSERT INTO contact_relationship (contact_id, related_contact_id, type_id) VALUES ('c1', 'c2', 'hermano')");
  db.run("DELETE FROM contact_relationship");
  assert.deepEqual(outbox(db), [
    'keyword,vip,vip,c1,upsert',
    'relationship,c2|hermano,c2,c1,upsert',
    'relationship,c2|hermano,c2,c1,delete',
  ]);
});

test('changes made while applying a pull are not recorded', () => {
  const db = makeDb();
  db.run("UPDATE sync_state SET v = 1 WHERE k = 'applying'");
  db.run("INSERT INTO contact_note (contact_id, note, remote_id) VALUES ('c1', 'hi', 'n1')");
  db.run("UPDATE sync_state SET v = 0 WHERE k = 'applying'");
  assert.deepEqual(outbox(db), []);
});

test('normalization moves legacy dates and document types to the backend formats', () => {
  const db = makeDb();
  db.run("UPDATE contact SET birthdate = '09/03/2001' WHERE contact_id = 'c1'");
  db.run("INSERT INTO national_identity_card (contact_id, doc_type, card_number, issue_date) VALUES ('c1', 'Cédula', '1', '01/02/2020')");
  db.run("INSERT INTO national_identity_card (contact_id, doc_type, card_number) VALUES ('c1', \"Driver's License\", '2')");
  for (let i = 0; i < 2; i++) for (const sql of schema.normalizeDataStatements()) db.exec(sql);
  assert.equal(db.exec("SELECT birthdate FROM contact")[0].values[0][0], '2001-03-09');
  const cards = db.exec('SELECT doc_type, issue_date FROM national_identity_card ORDER BY id')[0].values;
  assert.deepEqual(cards, [['national_id', '2020-02-01'], ['drivers_license', null]]);
});
