import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSearchParts, parseAgePart, searchChips, showSearchChips } from './searchQuery.js';

test('splits on & and drops empty parts', () => {
  assert.deepEqual(splitSearchParts(' ana & edad:>30 &  '), ['ana', 'edad:>30']);
  assert.deepEqual(splitSearchParts(''), []);
  assert.deepEqual(splitSearchParts(null), []);
});

test('recognises age filters in both languages with every operator', () => {
  assert.deepEqual(parseAgePart('age:23'), { op: '', value: 23 });
  assert.deepEqual(parseAgePart('EDAD:>=30'), { op: '>=', value: 30 });
  assert.deepEqual(parseAgePart('age:<18'), { op: '<', value: 18 });
  assert.deepEqual(parseAgePart('age:<=18'), { op: '<=', value: 18 });
  assert.equal(parseAgePart('age:abc'), null);
  assert.equal(parseAgePart('ana'), null);
  assert.equal(parseAgePart('age: 23'), null);
});

test('chips describe age filters and keep words as typed', () => {
  assert.deepEqual(searchChips('ana & edad:>=30', 'Edad'), ['ana', 'Edad ≥ 30']);
  assert.deepEqual(searchChips('age:23', 'Age'), ['Age 23']);
  assert.deepEqual(searchChips('age:<=5 & vip', 'Age'), ['Age ≤ 5', 'vip']);
});

test('chips appear only for age filters or several parts', () => {
  assert.equal(showSearchChips('ana'), false);
  assert.equal(showSearchChips('ana lopez'), false);
  assert.equal(showSearchChips('age:23'), true);
  assert.equal(showSearchChips('ana & vip'), true);
  assert.equal(showSearchChips(''), false);
});
