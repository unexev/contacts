import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import schema from '../utils/dbSchema.js';
import { applyPulledChanges } from '../utils/syncApply.ts';

const SQL = await initSqlJs();

function adapt(raw) {
  return {
    async getFirstAsync(sql, ...params) {
      const stmt = raw.prepare(sql);
      try { stmt.bind(params); return stmt.step() ? stmt.getAsObject() : null; } finally { stmt.free(); }
    },
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

const all = (raw, sql) => {
  const res = raw.exec(sql);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(v => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
};

const ns = (s) => ({ String: s ?? '', Valid: s != null });
const contact = (over = {}) => ({
  contact_id: 'c1', first_name: 'Ann', middle_name: '', surname: 'Lee', birthdate: '1990-03-14',
  gender: 'F', deceased: true, updated_at: 1700000000000, ...over,
});

test('a pull fills every table and leaves the outbox empty', async () => {
  const { raw, db } = makeDb();
  await applyPulledChanges(db, {
    organizations: [{ organization_id: 'o1', name: 'ACME' }],
    contacts: [contact(), contact({ contact_id: 'c2', first_name: 'Bob' })],
    phones: [{ phone_id: 'p1', contact_id: 'c1', phone: '555', label: ns('Casa'), is_active: false }],
    urls: [{ url_id: 'u1', contact_id: 'c1', url: 'https://a.b', label: ns(null) }],
    keywords: [{ contact_id: 'c1', keyword: 'vip' }],
    identity_cards: [{ card_id: 'k1', contact_id: 'c1', doc_type: 'passport', card_number: 'X1', issue_date: ns('2020-01-02'), expiry_date: ns(null), country_code: ns('EC') }],
    bank_accounts: [{ bank_account_id: 'b1', contact_id: 'c1', account_number: '123', bank_name: ns('Banco'), account_type: ns(null), label: ns(null) }],
    relationships: [{ contact_id: 'c1', related_contact_id: 'c2', type_id: 'hermano' }],
    contact_organizations: [{ contact_id: 'c1', organization_id: 'o1', organization_name: 'ACME', achievement: ns('CEO'), date: ns('2019-05-06') }],
  });
  const c = all(raw, 'SELECT birthdate, deceased, gender FROM contact WHERE contact_id = "c1"')[0];
  assert.deepEqual(c, { birthdate: '1990-03-14', deceased: 1, gender: 'FEMALE' });
  assert.equal(all(raw, 'SELECT is_active FROM contact_phone')[0].is_active, 0);
  assert.equal(all(raw, 'SELECT remote_id FROM contact_url')[0].remote_id, 'u1');
  assert.deepEqual(all(raw, 'SELECT doc_type, issue_date, country_code, remote_id FROM national_identity_card')[0],
    { doc_type: 'passport', issue_date: '2020-01-02', country_code: 'EC', remote_id: 'k1' });
  assert.equal(all(raw, 'SELECT bank_name FROM contact_bank_account')[0].bank_name, 'Banco');
  assert.equal(all(raw, 'SELECT keyword FROM contact_keyword')[0].keyword, 'vip');
  assert.equal(all(raw, 'SELECT type_id FROM contact_relationship')[0].type_id, 'hermano');
  assert.deepEqual(all(raw, 'SELECT achievement, date FROM contact_organization')[0], { achievement: 'CEO', date: '2019-05-06' });
  assert.deepEqual(all(raw, 'SELECT * FROM sync_outbox'), []);
  assert.equal(all(raw, "SELECT v FROM sync_state WHERE k = 'applying'")[0].v, 0);
});

test('applying the same payload twice changes nothing', async () => {
  const { raw, db } = makeDb();
  const payload = {
    contacts: [contact()],
    keywords: [{ contact_id: 'c1', keyword: 'vip' }],
    contact_organizations: [{ contact_id: 'c1', organization_id: 'o1', organization_name: 'ACME', achievement: ns('CEO'), date: ns(null) }],
  };
  await applyPulledChanges(db, payload);
  await applyPulledChanges(db, payload);
  assert.equal(all(raw, 'SELECT * FROM contact_keyword').length, 1);
  assert.equal(all(raw, 'SELECT * FROM contact_organization').length, 1);
  assert.equal(all(raw, 'SELECT * FROM organization').length, 1);
});

test('tombstones delete rows and a deleted contact takes its children along', async () => {
  const { raw, db } = makeDb();
  await applyPulledChanges(db, {
    contacts: [contact(), contact({ contact_id: 'c2' })],
    keywords: [{ contact_id: 'c1', keyword: 'vip' }],
    relationships: [{ contact_id: 'c1', related_contact_id: 'c2', type_id: 'hermano' }],
    urls: [{ url_id: 'u1', contact_id: 'c1', url: 'https://a.b', label: ns(null) }],
  });
  await applyPulledChanges(db, { keywords: [{ contact_id: 'c1', keyword: 'vip', deleted: true }] });
  assert.equal(all(raw, 'SELECT * FROM contact_keyword').length, 0);
  await applyPulledChanges(db, { contacts: [{ contact_id: 'c2', deleted: true }] });
  assert.equal(all(raw, 'SELECT * FROM contact_relationship').length, 0);
  await applyPulledChanges(db, { contacts: [{ contact_id: 'c1', deleted: true }] });
  assert.equal(all(raw, 'SELECT * FROM contact').length, 0);
  assert.equal(all(raw, 'SELECT * FROM contact_url').length, 0);
});

test('a local organization with the same name adopts the server id and keeps its links', async () => {
  const { raw, db } = makeDb();
  raw.run("INSERT INTO contact (contact_id, first_name, surname) VALUES ('c1', 'Ann', 'Lee')");
  raw.run("INSERT INTO organization (organization_id, name) VALUES ('local1', 'ACME')");
  raw.run("INSERT INTO contact_organization (contact_id, organization_id, achievement) VALUES ('c1', 'local1', 'CEO')");
  await applyPulledChanges(db, { organizations: [{ organization_id: 'srv1', name: 'ACME' }] });
  assert.deepEqual(all(raw, 'SELECT organization_id, name FROM organization'), [{ organization_id: 'srv1', name: 'ACME' }]);
  assert.equal(all(raw, 'SELECT organization_id FROM contact_organization')[0].organization_id, 'srv1');
});

test('rows of a contact that is missing locally are skipped instead of failing', async () => {
  const { raw, db } = makeDb();
  await applyPulledChanges(db, {
    keywords: [{ contact_id: 'ghost', keyword: 'x' }],
    relationships: [{ contact_id: 'ghost', related_contact_id: 'ghost2', type_id: 'hermano' }],
    contact_organizations: [{ contact_id: 'ghost', organization_id: 'o1', organization_name: 'ACME', achievement: ns('a'), date: ns(null) }],
  });
  assert.equal(all(raw, 'SELECT * FROM contact_keyword').length, 0);
  assert.equal(all(raw, 'SELECT * FROM contact_relationship').length, 0);
  assert.equal(all(raw, 'SELECT * FROM contact_organization').length, 0);
});

test('a pull stores locations and nationalities with their server ids and leaves the outbox empty', async () => {
  const { raw, db } = makeDb();
  await applyPulledChanges(db, {
    contacts: [contact()],
    locations: [
      { location_id: 'l1', contact_id: 'c1', location_type: 'residence', address: 'Av. Amazonas', city: 'Quito', region: '', country: 'EC', postal_code: '170101', latitude: -0.18, longitude: -78.47, updated_at: 1700000000000 },
      { location_id: 'l2', contact_id: 'c1', location_type: '', address: '', city: 'Cuenca', region: '', country: '', postal_code: '', latitude: null, longitude: null },
      { location_id: 'l3', contact_id: 'c1', location_type: 'work', address: '', city: '', region: '', country: '', postal_code: '', latitude: null, longitude: null },
    ],
    nationalities: [{ nationality_id: 'n1', contact_id: 'c1', country_code: 'EC', acquired_at: ns('2001-02-03'), note: ns('por nacimiento') }],
  });
  const locs = all(raw, 'SELECT remote_id, location_type, address, city, region, country, latitude, longitude FROM contact_location ORDER BY remote_id');
  assert.deepEqual(locs[0], { remote_id: 'l1', location_type: 'residence', address: 'Av. Amazonas', city: 'Quito', region: null, country: 'EC', latitude: -0.18, longitude: -78.47 });
  assert.equal(locs[1].city, 'Cuenca');
  assert.equal(locs[1].location_type, '');
  // A location with nothing filled in is not worth a row.
  assert.equal(locs.length, 2);
  assert.deepEqual(all(raw, 'SELECT remote_id, country_code, acquired_at, note FROM contact_nationality')[0],
    { remote_id: 'n1', country_code: 'EC', acquired_at: '2001-02-03', note: 'por nacimiento' });
  assert.deepEqual(all(raw, 'SELECT * FROM sync_outbox'), []);
});

test('pulled locations update in place, never adopt another location by type, and delete by server id', async () => {
  const { raw, db } = makeDb();
  await applyPulledChanges(db, { contacts: [contact()] });
  // A location made on this device and not pushed yet.
  raw.run("INSERT INTO contact_location (contact_id, location_type, city) VALUES ('c1', 'residence', 'Loja')");
  const row = (over) => ({ location_id: 'l1', contact_id: 'c1', location_type: 'residence', address: '', city: 'Quito', region: '', country: '', postal_code: '', latitude: null, longitude: null, ...over });
  await applyPulledChanges(db, { locations: [row({})] });
  await applyPulledChanges(db, { locations: [row({ city: 'Guayaquil' })] });
  const rows = all(raw, 'SELECT remote_id, city FROM contact_location ORDER BY id');
  assert.deepEqual(rows, [{ remote_id: null, city: 'Loja' }, { remote_id: 'l1', city: 'Guayaquil' }]);
  await applyPulledChanges(db, { locations: [{ ...row({}), deleted: true }] });
  assert.deepEqual(all(raw, 'SELECT city FROM contact_location'), [{ city: 'Loja' }]);
});

test('deleting a contact on the server removes its locations and nationalities', async () => {
  const { raw, db } = makeDb();
  await applyPulledChanges(db, {
    contacts: [contact()],
    locations: [{ location_id: 'l1', contact_id: 'c1', location_type: 'work', address: 'X', city: '', region: '', country: '', postal_code: '', latitude: null, longitude: null }],
    nationalities: [{ nationality_id: 'n1', contact_id: 'c1', country_code: 'EC', acquired_at: ns(null), note: ns(null) }],
  });
  await applyPulledChanges(db, { contacts: [contact({ deleted: true })] });
  assert.deepEqual(all(raw, 'SELECT * FROM contact_location'), []);
  assert.deepEqual(all(raw, 'SELECT * FROM contact_nationality'), []);
});

test('the creation time is stored on pull and survives later edits', async () => {
  const { raw, db } = makeDb();
  const created = Date.UTC(2024, 0, 2, 3, 4, 5);
  await applyPulledChanges(db, { contacts: [contact({ created_at: created, updated_at: created })] });
  assert.equal(all(raw, 'SELECT created_at FROM contact WHERE contact_id = "c1"')[0].created_at, '2024-01-02 03:04:05');
  // A later edit reaches the device with a newer updated_at; creation time must not move.
  await applyPulledChanges(db, { contacts: [contact({ created_at: created, updated_at: created + 86400000, first_name: 'Anita' })] });
  // An answer without created_at must not wipe it either.
  await applyPulledChanges(db, { contacts: [contact({ updated_at: created + 2 * 86400000 })] });
  const row = all(raw, 'SELECT first_name, created_at FROM contact WHERE contact_id = "c1"')[0];
  assert.equal(row.created_at, '2024-01-02 03:04:05');
});
