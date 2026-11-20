import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCATION_TYPES, parseCoordinate, validateLocation, validateNationality, locationSummary } from '../utils/placeRecords.ts';

test('location types match the web client', () => {
  assert.deepEqual(LOCATION_TYPES, ['birth', 'residence', 'work', 'other']);
});

test('parseCoordinate reads decimals with a point or a comma and checks the range', () => {
  assert.deepEqual(parseCoordinate('-0.18', 90), { ok: true, value: -0.18 });
  assert.deepEqual(parseCoordinate(' 78,47 ', 180), { ok: true, value: 78.47 });
  assert.deepEqual(parseCoordinate('', 90), { ok: true, value: null });
  assert.deepEqual(parseCoordinate('   ', 90), { ok: true, value: null });
  for (const v of ['abc', '91', '-91', '1e3', '1.2.3', 'NaN', 'Infinity']) assert.equal(parseCoordinate(v, 90).ok, false, v);
  assert.deepEqual(parseCoordinate('90', 90), { ok: true, value: 90 });
});

test('validateLocation needs something to say and both coordinates or none', () => {
  const base = { type: 'residence', address: '', city: '', region: '', country: '', postalCode: '', latitude: '', longitude: '' };
  assert.deepEqual(validateLocation(base), { ok: false, error: 'empty' });
  assert.deepEqual(validateLocation({ ...base, city: ' Quito ', latitude: '-0.18' }), { ok: false, error: 'coordinates' });
  assert.deepEqual(validateLocation({ ...base, city: 'Quito', latitude: '100', longitude: '1' }), { ok: false, error: 'latitude' });
  assert.deepEqual(validateLocation({ ...base, city: 'Quito', latitude: '1', longitude: '181' }), { ok: false, error: 'longitude' });
  const ok = validateLocation({ ...base, type: 'work', city: ' Quito ', country: 'Ecuador', latitude: '-0,18', longitude: '-78.47' });
  assert.deepEqual(ok, { ok: true, value: { locationType: 'work', address: null, city: 'Quito', region: null, country: 'Ecuador', postalCode: null, latitude: -0.18, longitude: -78.47 } });
});

test('validateLocation keeps only known types', () => {
  const base = { address: 'X', city: '', region: '', country: '', postalCode: '', latitude: '', longitude: '' };
  assert.equal(validateLocation({ ...base, type: 'nope' }).value.locationType, '');
  assert.equal(validateLocation({ ...base, type: '' }).value.locationType, '');
  assert.equal(validateLocation({ ...base, type: 'birth' }).value.locationType, 'birth');
});

test('validateNationality needs a known country and a real date when given', () => {
  assert.deepEqual(validateNationality({ countryCode: null, acquiredAt: '', note: '' }), { ok: false, error: 'country' });
  assert.deepEqual(validateNationality({ countryCode: 'ZZ', acquiredAt: '', note: '' }), { ok: false, error: 'country' });
  assert.deepEqual(validateNationality({ countryCode: 'EC', acquiredAt: '31/02/2001', note: '' }), { ok: false, error: 'date' });
  assert.deepEqual(validateNationality({ countryCode: 'ec', acquiredAt: '03/02/2001', note: ' por nacimiento ' }),
    { ok: true, value: { countryCode: 'EC', acquiredAt: '2001-02-03', note: 'por nacimiento' } });
  assert.deepEqual(validateNationality({ countryCode: 'OTHER', acquiredAt: '', note: '' }),
    { ok: true, value: { countryCode: 'OTHER', acquiredAt: null, note: null } });
});

test('locationSummary joins the filled parts', () => {
  assert.equal(locationSummary({ address: 'Av. 1', city: 'Quito', region: null, country: 'EC', postal_code: '170101' }), 'Av. 1, Quito, EC, 170101');
  assert.equal(locationSummary({ address: null, city: null, region: null, country: null, postal_code: null }), '');
});
