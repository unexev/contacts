import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthdaysOn, birthdaysTomorrow } from '../utils/birthdays.ts';

const contacts = [
  { contact_id: 'a', first_name: 'Ana', surname: 'Pérez', birthdate: '14/11/1990' },
  { contact_id: 'b', first_name: 'Beto', surname: 'Ruiz', birthdate: '15/11/1985' },
  { contact_id: 'c', first_name: 'Caro', surname: 'Díaz', birthdate: null },
  { contact_id: 'd', first_name: 'Dani', surname: 'Gil', birthdate: 'not a date' },
  { contact_id: 'e', first_name: 'Eva', surname: 'Sol', birthdate: '29/02/2000' },
  { contact_id: 'f', first_name: 'Fede', surname: 'Paz', birthdate: '01/01/1970' },
];

test('selects contacts whose birthday is tomorrow', () => {
  const now = new Date(2026, 10, 13, 9, 30);
  assert.deepEqual(birthdaysTomorrow(contacts, now).map(c => c.contact_id), ['a']);
});

test('ignores missing and malformed birthdates', () => {
  const ids = birthdaysOn(contacts, new Date(2026, 10, 14)).map(c => c.contact_id);
  assert.deepEqual(ids, ['a']);
});

test('wraps around the end of the year', () => {
  const now = new Date(2026, 11, 31, 23, 0);
  assert.deepEqual(birthdaysTomorrow(contacts, now).map(c => c.contact_id), ['f']);
});

test('29 February birthdays fall on 1 March in non-leap years', () => {
  assert.deepEqual(birthdaysOn(contacts, new Date(2027, 2, 1)).map(c => c.contact_id), ['e']);
  assert.deepEqual(birthdaysOn(contacts, new Date(2028, 1, 29)).map(c => c.contact_id), ['e']);
  assert.deepEqual(birthdaysOn(contacts, new Date(2028, 2, 1)).map(c => c.contact_id), []);
});
