import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, toIsoDate, toDisplayDate, dateSortKey } from '../utils/dates.ts';

test('ISO and legacy dd/mm/yyyy parse to the same date', () => {
  assert.deepEqual(parseDate('2001-03-09'), { day: 9, month: 3, year: 2001 });
  assert.deepEqual(parseDate('9/3/2001'), { day: 9, month: 3, year: 2001 });
  assert.deepEqual(parseDate('09/03/2001'), { day: 9, month: 3, year: 2001 });
});

test('invalid or empty values give null', () => {
  for (const v of [null, undefined, '', '31/02/2001', '2001-13-01', 'abc', '2001-02-30']) {
    assert.equal(parseDate(v), null, String(v));
  }
});

test('29 Feb only exists in leap years', () => {
  assert.ok(parseDate('2000-02-29'));
  assert.equal(parseDate('2001-02-29'), null);
});

test('storage is ISO, display is dd/mm/yyyy', () => {
  assert.equal(toIsoDate('09/03/2001'), '2001-03-09');
  assert.equal(toIsoDate('2001-03-09'), '2001-03-09');
  assert.equal(toIsoDate('1/2/1999'), '1999-02-01');
  assert.equal(toIsoDate('nope'), null);
  assert.equal(toDisplayDate('2001-03-09'), '09/03/2001');
  assert.equal(toDisplayDate(null), '');
});

test('sort key orders by year, month, day', () => {
  assert.ok(dateSortKey('1999-12-31') < dateSortKey('2000-01-01'));
  assert.equal(dateSortKey(null), null);
});
