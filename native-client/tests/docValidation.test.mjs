import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument, hasStrictRule, ecCedulaProvince } from '../utils/docValidation.ts';
import { isValidCountryCode, countryName, COUNTRY_CODES } from '../utils/countries.ts';

// 1710034065 is a well-formed Pichincha cédula (check digit 5).
test('a valid Ecuadorian cédula passes, with or without formatting', () => {
  assert.deepEqual(validateDocument('EC', 'national_id', '1710034065'), { valid: true, normalized: '1710034065' });
  assert.equal(validateDocument('ec', 'national_id', ' 171003-4065 ').valid, true);
});

test('each cédula rule reports its own error', () => {
  assert.deepEqual(validateDocument('EC', 'national_id', '12345'), { valid: false, error: 'ecLength' });
  assert.deepEqual(validateDocument('EC', 'national_id', '12345678901'), { valid: false, error: 'ecLength' });
  assert.deepEqual(validateDocument('EC', 'national_id', '9910034065'), { valid: false, error: 'ecProvince' });
  assert.deepEqual(validateDocument('EC', 'national_id', '1760034065'), { valid: false, error: 'ecThirdDigit' });
  assert.deepEqual(validateDocument('EC', 'national_id', '1710034064'), { valid: false, error: 'ecCheckDigit' });
});

test('province 30 (issued abroad) is accepted', () => {
  const body = '300003406';
  const coeffs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const sum = [...body].reduce((a, d, i) => { let p = Number(d) * coeffs[i]; if (p > 9) p -= 9; return a + p; }, 0);
  assert.equal(validateDocument('EC', 'national_id', body + ((10 - (sum % 10)) % 10)).valid, true);
});

test('other countries and document types have no strict rule', () => {
  assert.equal(validateDocument('CO', 'national_id', 'abc').valid, true);
  assert.equal(validateDocument('EC', 'passport', 'abc').valid, true);
  assert.equal(validateDocument(null, 'national_id', 'abc').valid, true);
  assert.equal(hasStrictRule('EC', 'national_id'), true);
  assert.equal(hasStrictRule('EC', 'passport'), false);
});

test('province comes from the first two digits, even while typing', () => {
  assert.equal(ecCedulaProvince('EC', 'national_id', '1710034065'), 'Pichincha');
  assert.equal(ecCedulaProvince('EC', 'national_id', '09'), 'Guayas');
  assert.equal(ecCedulaProvince('EC', 'national_id', '0'), null);
  assert.equal(ecCedulaProvince('EC', 'national_id', '3010034065'), null);
  assert.equal(ecCedulaProvince('CO', 'national_id', '1710034065'), null);
  assert.equal(ecCedulaProvince('EC', 'passport', '1710034065'), null);
  assert.equal(ecCedulaProvince(null, 'national_id', '1710034065'), null);
});

test('country codes are validated case-insensitively and named through the table', () => {
  assert.equal(isValidCountryCode('ec'), true);
  assert.equal(isValidCountryCode('XX'), false);
  assert.equal(isValidCountryCode(null), false);
  assert.equal(COUNTRY_CODES.length, 26);
  assert.equal(countryName('ec', { EC: 'Ecuador' }), 'Ecuador');
  assert.equal(countryName('ZZ', { EC: 'Ecuador' }), 'ZZ');
});
