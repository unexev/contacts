import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSearchFilter, getSearchChips, filterContactsByPhone,
  filterContactsByRelationshipStatus, filterContactsByChildren,
} from '../utils/contactList.ts';

test('parseSearchFilter reads the age keyword in English and Spanish', () => {
  assert.deepEqual(parseSearchFilter('age:23'), { type: 'age', op: 'eq', value: 23 });
  assert.deepEqual(parseSearchFilter('edad:23'), { type: 'age', op: 'eq', value: 23 });
  assert.deepEqual(parseSearchFilter('EDAD:>=18'), { type: 'age', op: 'gte', value: 18 });
  assert.deepEqual(parseSearchFilter('age:<65'), { type: 'age', op: 'lt', value: 65 });
});

test('parseSearchFilter keeps everything else as text', () => {
  assert.deepEqual(parseSearchFilter('ana'), { type: 'text', value: 'ana' });
  assert.deepEqual(parseSearchFilter('edad:'), { type: 'text', value: 'edad:' });
  assert.deepEqual(parseSearchFilter('  maria  '), { type: 'text', value: 'maria' });
});

test('getSearchChips labels age filters with the provided word', () => {
  assert.deepEqual(getSearchChips('edad:>30 & ana', 'Edad'), ['Edad > 30', 'ana']);
  assert.deepEqual(getSearchChips('age:<=40', 'Age'), ['Age ≤ 40']);
  assert.deepEqual(getSearchChips('age:23', 'Age'), ['Age 23']);
});

test('getSearchChips defaults to the English label', () => {
  assert.deepEqual(getSearchChips('age:>=18'), ['Age ≥ 18']);
});

test('getSearchChips ignores empty queries and empty parts', () => {
  assert.deepEqual(getSearchChips('   '), []);
  assert.deepEqual(getSearchChips('ana & & luis'), ['ana', 'luis']);
});

test('filterContactsByPhone keeps contacts by phone presence', () => {
  const list = [
    { contact_id: 'a', first_name: 'Ana', surname: 'Diaz' },
    { contact_id: 'b', first_name: 'Beto', surname: 'Paz' },
  ];
  const phoneIds = new Set(['a']);

  assert.deepEqual(filterContactsByPhone(list, { mode: 'all' }, phoneIds), list);
  assert.deepEqual(filterContactsByPhone(list, { mode: 'with' }, phoneIds).map(c => c.contact_id), ['a']);
  assert.deepEqual(filterContactsByPhone(list, { mode: 'without' }, phoneIds).map(c => c.contact_id), ['b']);
});

const familyList = [
  { contact_id: 'a', first_name: 'Ana', surname: 'Diaz', relationship_status: 'SINGLE', children_count: 2 },
  { contact_id: 'b', first_name: 'Beto', surname: 'Paz', relationship_status: 'PARTNERED', children_count: 0 },
  { contact_id: 'c', first_name: 'Carla', surname: 'Rios', relationship_status: 'COHABITING', children_count: null },
  { contact_id: 'd', first_name: 'Dani', surname: 'Sol', relationship_status: null },
];
const ids = list => list.map(c => c.contact_id);

test('filterContactsByRelationshipStatus keeps each value and treats null as unspecified', () => {
  assert.deepEqual(filterContactsByRelationshipStatus(familyList, null), familyList);
  assert.deepEqual(ids(filterContactsByRelationshipStatus(familyList, 'SINGLE')), ['a']);
  assert.deepEqual(ids(filterContactsByRelationshipStatus(familyList, 'PARTNERED')), ['b']);
  assert.deepEqual(ids(filterContactsByRelationshipStatus(familyList, 'COHABITING')), ['c']);
  assert.deepEqual(ids(filterContactsByRelationshipStatus(familyList, 'UNSPECIFIED')), ['d']);
});

test('filterContactsByChildren splits by count and unknown matches neither side', () => {
  assert.deepEqual(filterContactsByChildren(familyList, { mode: 'all' }), familyList);
  assert.deepEqual(ids(filterContactsByChildren(familyList, { mode: 'with' })), ['a']);
  assert.deepEqual(ids(filterContactsByChildren(familyList, { mode: 'without' })), ['b']);
});
