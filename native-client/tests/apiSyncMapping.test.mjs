import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGender, normalizeStatusId, msToSqliteDatetime, mapContactRow, nullStringValue, isoToLocalBirthdate,
  normalizeRelationshipStatus, normalizeChildrenCount, contactPushNullFields,
} from '../utils/syncMapping.ts';

test('normalizeGender maps backend variants to the local CHECK values', () => {
  for (const v of ['M', 'm', 'MALE', 'male', ' Male ']) assert.equal(normalizeGender(v), 'MALE', v);
  for (const v of ['F', 'f', 'FEMALE', 'female']) assert.equal(normalizeGender(v), 'FEMALE', v);
});

test('normalizeGender returns null for empty or unknown values', () => {
  for (const v of [null, undefined, '', '  ', 'X', 'other']) assert.equal(normalizeGender(v), null, String(v));
});

test('normalizeStatusId keeps only statuses known locally', () => {
  assert.equal(normalizeStatusId('casado'), 'casado');
  assert.equal(normalizeStatusId('CASADO'), 'casado');
  assert.equal(normalizeStatusId('unknown'), null);
  assert.equal(normalizeStatusId(null), null);
});

test('msToSqliteDatetime formats epoch milliseconds like datetime(now)', () => {
  assert.equal(msToSqliteDatetime(0), '1970-01-01 00:00:00');
  assert.equal(msToSqliteDatetime(1700000000123), '2023-11-14 22:13:20');
});

test('msToSqliteDatetime falls back to null for invalid input', () => {
  assert.equal(msToSqliteDatetime(undefined), null);
  assert.equal(msToSqliteDatetime(Number.NaN), null);
});

test('mapContactRow produces the local contact columns', () => {
  const row = mapContactRow({
    contact_id: 'c1', first_name: 'Ann', middle_name: '', surname: 'Lee',
    birthdate: '1990-01-02', gender: 'F', status_id: 'zzz', updated_at: 1700000000000,
  });
  assert.deepEqual(row, {
    contact_id: 'c1', first_name: 'Ann', middle_name: null, surname: 'Lee',
    birthdate: '02/01/1990', gender: 'FEMALE', status_id: null,
    relationship_status: null, children_count: null, updated_at: '2023-11-14 22:13:20',
  });
});

test('nullStringValue unwraps the backend NullString shape', () => {
  assert.equal(nullStringValue({ String: 'Work', Valid: true }), 'Work');
  assert.equal(nullStringValue({ String: '', Valid: false }), null);
  assert.equal(nullStringValue({ String: 'ignored', Valid: false }), null);
});

test('nullStringValue accepts plain strings and rejects empty or unusable values', () => {
  assert.equal(nullStringValue(' Home '), 'Home');
  for (const v of [null, undefined, '', '   ', 42, {}, { Valid: true }]) assert.equal(nullStringValue(v), null, String(v));
});

test('isoToLocalBirthdate converts ISO dates to the local DD/MM/YYYY format', () => {
  assert.equal(isoToLocalBirthdate('1990-03-14'), '14/03/1990');
  assert.equal(isoToLocalBirthdate('2000-01-09T00:00:00Z'), '09/01/2000');
});

test('isoToLocalBirthdate keeps values already in local format and drops invalid ones', () => {
  assert.equal(isoToLocalBirthdate('14/03/1990'), '14/03/1990');
  for (const v of [null, undefined, '', 'not a date', '1990-13-40', '0000-00-00']) assert.equal(isoToLocalBirthdate(v), null, String(v));
});

test('mapContactRow stores the birthdate in the local format', () => {
  const r = mapContactRow({ contact_id: 'c1', first_name: 'ANA', surname: 'GARCIA', birthdate: '1990-03-14' });
  assert.equal(r.birthdate, '14/03/1990');
});

test('normalizeRelationshipStatus keeps only the known values', () => {
  assert.equal(normalizeRelationshipStatus('SINGLE'), 'SINGLE');
  assert.equal(normalizeRelationshipStatus(' partnered '), 'PARTNERED');
  assert.equal(normalizeRelationshipStatus('COHABITING'), 'COHABITING');
  for (const v of [null, undefined, '', 'MARRIED']) assert.equal(normalizeRelationshipStatus(v), null, String(v));
});

test('normalizeChildrenCount accepts integers from 0 to 50', () => {
  assert.equal(normalizeChildrenCount(0), 0);
  assert.equal(normalizeChildrenCount(3), 3);
  assert.equal(normalizeChildrenCount('12'), 12);
  assert.equal(normalizeChildrenCount(50), 50);
  for (const v of [null, undefined, '', ' ', -1, 51, 2.5, '1a', 'abc', NaN]) assert.equal(normalizeChildrenCount(v), null, String(v));
});

test('mapContactRow keeps the relationship status and children count', () => {
  const r = mapContactRow({ contact_id: 'c1', first_name: 'A', surname: 'B', relationship_status: 'COHABITING', children_count: 0 });
  assert.equal(r.relationship_status, 'COHABITING');
  assert.equal(r.children_count, 0);
  const u = mapContactRow({ contact_id: 'c1', first_name: 'A', surname: 'B', relationship_status: 'X', children_count: -2 });
  assert.equal(u.relationship_status, null);
  assert.equal(u.children_count, null);
});

test('contactPushNullFields encodes values in the Go sql.Null shapes', () => {
  assert.deepEqual(contactPushNullFields({ gender: 'MALE', status_id: 'soltero', relationship_status: 'SINGLE', children_count: 2 }), {
    gender: { String: 'MALE', Valid: true },
    status_id: { String: 'soltero', Valid: true },
    relationship_status: { String: 'SINGLE', Valid: true },
    children_count: { Int64: 2, Valid: true },
  });
  assert.deepEqual(contactPushNullFields({ children_count: 0 }), {
    gender: { String: '', Valid: false },
    status_id: { String: '', Valid: false },
    relationship_status: { String: '', Valid: false },
    children_count: { Int64: 0, Valid: true },
  });
  assert.deepEqual(contactPushNullFields({ relationship_status: null, children_count: null }).children_count, { Int64: 0, Valid: false });
});
