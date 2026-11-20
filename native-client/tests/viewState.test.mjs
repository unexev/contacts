import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIEW, sanitizeView, parseView, serializeView, isDefaultView } from '../utils/viewState.ts';

const view = (o) => ({ ...DEFAULT_VIEW, ...o });

test('a saved view survives a round trip', () => {
  const v = view({
    sortKey: 'age_desc', genderFilter: 'FEMALE', birthdateFilter: 'with', cedulaFilter: { mode: 'without' },
    phoneFilter: { mode: 'with' }, organizationFilter: { mode: 'specific', organizationId: 'org_1' },
    maritalStatusFilter: { mode: 'specific', statusId: 'casado' }, relationshipFilter: 'COHABITING', childrenFilter: { mode: 'with' },
  });
  assert.deepEqual(parseView(serializeView(v)), v);
});

test('nothing stored, or stored garbage, gives the default view', () => {
  for (const bad of [null, undefined, '', 'not json', '[]', 'null', '42', '"x"']) {
    assert.deepEqual(parseView(bad), DEFAULT_VIEW, String(bad));
  }
});

test('unknown values fall back field by field and good ones are kept', () => {
  const v = sanitizeView({ sortKey: 'nope', genderFilter: 'X', birthdateFilter: 'maybe', relationshipFilter: 'COHABITING', phoneFilter: { mode: 'with' } });
  assert.equal(v.sortKey, 'first_name');
  assert.equal(v.genderFilter, null);
  assert.equal(v.birthdateFilter, 'all');
  assert.equal(v.relationshipFilter, 'COHABITING');
  assert.deepEqual(v.phoneFilter, { mode: 'with' });
});

test('a specific filter needs a plausible id, otherwise it is switched off', () => {
  assert.deepEqual(sanitizeView({ organizationFilter: { mode: 'specific' } }).organizationFilter, { mode: 'all' });
  assert.deepEqual(sanitizeView({ organizationFilter: { mode: 'specific', organizationId: '../x y' } }).organizationFilter, { mode: 'all' });
  assert.deepEqual(sanitizeView({ maritalStatusFilter: { mode: 'specific', statusId: 'soltero' } }).maritalStatusFilter, { mode: 'specific', statusId: 'soltero' });
  assert.deepEqual(sanitizeView({ organizationFilter: { mode: 'with', organizationId: 'org_1' } }).organizationFilter, { mode: 'with' });
});

test('search text is not part of the view', () => {
  assert.equal('searchQuery' in sanitizeView({ searchQuery: 'ana', sortKey: 'surname' }), false);
});

test('isDefaultView tells whether anything is applied', () => {
  assert.equal(isDefaultView(DEFAULT_VIEW), true);
  assert.equal(isDefaultView(view({ genderFilter: 'MALE' })), false);
  assert.equal(isDefaultView(view({ sortKey: 'surname' })), false);
});
