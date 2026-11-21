import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortContacts } from '../utils/contactList.ts';

const c = (id, first, created_at, rowid) => ({ contact_id: id, first_name: first, surname: 'X', created_at, rowid });
const ids = (list) => list.map((x) => x.contact_id);

test('recently added sorts by creation time, not by row order', () => {
  // rowid follows the pull order (last edit), which is not when the contact was added.
  const list = [
    c('old', 'A', '2024-01-01 10:00:00', 3),
    c('new', 'B', '2025-06-01 10:00:00', 1),
    c('mid', 'C', '2024-09-01 10:00:00', 2),
  ];
  assert.deepEqual(ids(sortContacts(list, 'insertion_desc')), ['new', 'mid', 'old']);
  assert.deepEqual(ids(sortContacts(list, 'insertion_asc')), ['old', 'mid', 'new']);
});

test('contacts without a creation time count as the oldest and ties fall back to the name', () => {
  const list = [
    c('b', 'Bea', '2025-01-01 00:00:00', 1),
    c('none', 'Zed', null, 2),
    c('a', 'Ana', '2025-01-01 00:00:00', 3),
  ];
  assert.deepEqual(ids(sortContacts(list, 'insertion_desc')), ['a', 'b', 'none']);
  assert.deepEqual(ids(sortContacts(list, 'insertion_asc')), ['none', 'a', 'b']);
});
