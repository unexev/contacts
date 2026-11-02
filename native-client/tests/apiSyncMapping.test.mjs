import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGender, normalizeStatusId, msToSqliteDatetime, mapContactRow } from '../utils/syncMapping.ts';

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
    birthdate: '1990-01-02', gender: 'FEMALE', status_id: null, updated_at: '2023-11-14 22:13:20',
  });
});
