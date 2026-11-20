import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import schema from '../utils/dbSchema.js';
import { normalizePhoneLabel, phoneLabelText, PHONE_LABELS } from '../utils/phoneLabels.ts';

const names = { phoneLabelPersonal: 'Personal', phoneLabelWork: 'Work', phoneLabelHome: 'Home', phoneLabelOther: 'Other' };

test('labels are stored as the canonical word whatever the case or language of the alias', () => {
  assert.equal(normalizePhoneLabel('PERSONAL'), 'Personal');
  assert.equal(normalizePhoneLabel(' trabajo '), 'Trabajo');
  assert.equal(normalizePhoneLabel('home'), 'Casa');
  assert.equal(normalizePhoneLabel('CELL'), 'Personal');
  assert.equal(normalizePhoneLabel('Oficina'), 'Trabajo');
});

test('labels outside the list are kept, and empty stays empty', () => {
  assert.equal(normalizePhoneLabel('Mamá'), 'Mamá');
  assert.equal(normalizePhoneLabel(null), '');
  assert.equal(normalizePhoneLabel('  '), '');
});

test('only known labels are translated for display', () => {
  assert.equal(phoneLabelText('Trabajo', names), 'Work');
  assert.equal(phoneLabelText('CASA', names), 'Home');
  assert.equal(phoneLabelText('Mamá', names), 'Mamá');
  assert.equal(PHONE_LABELS.length, 4);
});

test('the data migration canonicalises stored labels and leaves others alone', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(schema.createTablesSql);
  db.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'A', 'B')");
  for (const label of ['PERSONAL', 'trabajo', 'Casa', 'Mamá', null]) {
    db.run('INSERT INTO contact_phone (contact_id, phone, label) VALUES (?, ?, ?)', ['c1', '1', label]);
  }
  for (const sql of schema.normalizeDataStatements()) db.exec(sql);
  const labels = db.exec('SELECT label FROM contact_phone ORDER BY id')[0].values.map(v => v[0]);
  assert.deepEqual(labels, ['Personal', 'Trabajo', 'Casa', 'Mamá', null]);
});
