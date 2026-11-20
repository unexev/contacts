import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import schema from '../utils/dbSchema.js';
import { contactActions, PRIMARY_CONTACT_COLUMNS } from '../utils/contactActions.ts';

const keys = (...a) => contactActions(...a).map(x => x.key);

test('a phone and an email offer call, WhatsApp, email and copy', () => {
  assert.deepEqual(keys('0991234567', 'a@b.co'), ['call', 'whatsapp', 'email', 'copy']);
  const [call, wa, mail] = contactActions('0991234567', 'a@b.co');
  assert.equal(call.url, 'tel:0991234567');
  assert.equal(wa.url, 'https://wa.me/593991234567');
  assert.equal(mail.url, 'mailto:a@b.co');
});

test('a number no longer in use only offers copy (and email)', () => {
  assert.deepEqual(keys('0991234567', '', false), ['copy']);
  assert.deepEqual(keys('0991234567', 'a@b.co', false), ['email', 'copy']);
});

test('a number too short for WhatsApp skips it, and nothing yields no actions', () => {
  assert.deepEqual(keys('123', ''), ['call', 'copy']);
  assert.deepEqual(keys('', ''), []);
  assert.deepEqual(keys('', 'a@b.co'), ['email']);
});

test('the list columns pick the first active phone and the first email', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(schema.createTablesSql);
  db.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1','A','B'), ('c2','C','D'), ('c3','E','F')");
  db.run("INSERT INTO contact_phone (contact_id, phone, is_active) VALUES ('c1','111',0), ('c1','222',1), ('c2','333',0)");
  db.run("INSERT INTO contact_email (contact_id, email) VALUES ('c1','x@y.co'), ('c1','z@y.co')");
  const rows = db.exec(`SELECT c.contact_id, ${PRIMARY_CONTACT_COLUMNS} FROM contact c ORDER BY c.contact_id`)[0].values;
  assert.deepEqual(rows, [
    ['c1', '222', 0, 'x@y.co'],
    ['c2', '333', 1, ''],
    ['c3', '', 0, ''],
  ]);
});
