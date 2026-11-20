import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmail,
  validatePassword,
  validateName,
  loginRequest,
  registerRequest,
  mapAuthFailure,
  resendVerificationRequest,
  mapDeleteFailure,
} from '../utils/authApi.ts';

function fakeFetch(status, body, { throws } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (throws) throw new Error('boom');
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body === undefined) throw new Error('no json');
        return body;
      },
    };
  };
  fn.calls = calls;
  return fn;
}

const okBody = { data: { token: 'jwt', refresh_token: 'rt', user: { id: 'u1', email: 'a@b.co', name: 'A' } } };

test('validateEmail', () => {
  assert.equal(validateEmail('a@b.co'), null);
  assert.equal(validateEmail('  a@b.co  '), null);
  assert.equal(validateEmail(''), 'authEmailInvalid');
  assert.equal(validateEmail('nope'), 'authEmailInvalid');
  assert.equal(validateEmail('a@b'), 'authEmailInvalid');
});

test('validatePassword enforces minimum length', () => {
  assert.equal(validatePassword('12345678'), null);
  assert.equal(validatePassword('1234567'), 'authPasswordShort');
  assert.equal(validatePassword(''), 'authPasswordShort');
});

test('validateName requires non-blank', () => {
  assert.equal(validateName('Ann'), null);
  assert.equal(validateName('   '), 'authNameRequired');
});

test('loginRequest posts credentials and parses envelope', async () => {
  const f = fakeFetch(200, okBody);
  const res = await loginRequest(f, 'http://api', ' a@b.co ', 'Test1234!');
  assert.deepEqual(res, { ok: true, session: { token: 'jwt', refreshToken: 'rt', user: okBody.data.user } });
  assert.equal(f.calls[0].url, 'http://api/api/auth/login');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { email: 'a@b.co', password: 'Test1234!' });
});

test('registerRequest posts name, email and password', async () => {
  const f = fakeFetch(201, okBody);
  const res = await registerRequest(f, 'http://api', 'a@b.co', ' Ann ', 'Test1234!');
  assert.equal(res.ok, true);
  assert.equal(f.calls[0].url, 'http://api/api/auth/register');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { email: 'a@b.co', name: 'Ann', password: 'Test1234!' });
});

test('invalid input short-circuits without calling fetch', async () => {
  const f = fakeFetch(200, okBody);
  assert.deepEqual(await loginRequest(f, 'http://api', 'bad', 'Test1234!'), { ok: false, errorKey: 'authEmailInvalid' });
  assert.deepEqual(await loginRequest(f, 'http://api', 'a@b.co', ''), { ok: false, errorKey: 'authPasswordShort' });
  assert.deepEqual(await registerRequest(f, 'http://api', 'a@b.co', '', 'Test1234!'), { ok: false, errorKey: 'authNameRequired' });
  assert.equal(f.calls.length, 0);
});

test('failure statuses map to stable keys', async () => {
  const cases = [
    [401, 'authInvalidCredentials'],
    [409, 'authEmailTaken'],
    [400, 'authRequestInvalid'],
    [429, 'authRateLimited'],
    [500, 'authGeneric'],
  ];
  for (const [status, key] of cases) {
    const res = await loginRequest(fakeFetch(status, { error: 'x' }), 'http://api', 'a@b.co', 'Test1234!');
    assert.deepEqual(res, { ok: false, errorKey: key }, `status ${status}`);
  }
});

test('network failure maps to authNetwork', async () => {
  const res = await loginRequest(fakeFetch(0, undefined, { throws: true }), 'http://api', 'a@b.co', 'Test1234!');
  assert.deepEqual(res, { ok: false, errorKey: 'authNetwork' });
  assert.equal(mapAuthFailure(0), 'authNetwork');
});

test('malformed success envelope is a generic failure', async () => {
  const res = await loginRequest(fakeFetch(200, { data: {} }), 'http://api', 'a@b.co', 'Test1234!');
  assert.deepEqual(res, { ok: false, errorKey: 'authGeneric' });
  const res2 = await loginRequest(fakeFetch(200, undefined), 'http://api', 'a@b.co', 'Test1234!');
  assert.deepEqual(res2, { ok: false, errorKey: 'authGeneric' });
});

test('403 on login asks the user to confirm their email', async () => {
  const res = await loginRequest(fakeFetch(403, { error: 'email not verified' }), 'http://api', 'a@b.co', 'Test1234!');
  assert.deepEqual(res, { ok: false, errorKey: 'authVerificationRequired' });
});

test('register answering verification_required is not a generic failure', async () => {
  const res = await registerRequest(
    fakeFetch(201, { data: { verification_required: true, user: { id: 'u1' } } }),
    'http://api', 'a@b.co', 'A', 'Test1234!'
  );
  assert.deepEqual(res, { ok: false, errorKey: 'authVerificationRequired' });
});

test('resendVerificationRequest maps statuses', async () => {
  const f = fakeFetch(200, {});
  assert.deepEqual(await resendVerificationRequest(f, 'http://api', ' a@b.co ', 'pw'), { ok: true });
  assert.equal(f.calls[0].url, 'http://api/api/auth/resend-verification');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { email: 'a@b.co', password: 'pw' });
  assert.deepEqual(await resendVerificationRequest(fakeFetch(429, {}), 'http://api', 'a@b.co', 'pw'), { ok: false, reason: 'wait' });
  assert.deepEqual(await resendVerificationRequest(fakeFetch(409, {}), 'http://api', 'a@b.co', 'pw'), { ok: false, reason: 'done' });
  assert.deepEqual(await resendVerificationRequest(fakeFetch(500, {}), 'http://api', 'a@b.co', 'pw'), { ok: false, reason: 'failed' });
  assert.deepEqual(await resendVerificationRequest(fakeFetch(0, {}, { throws: true }), 'http://api', 'a@b.co', 'pw'), { ok: false, reason: 'failed' });
});

test('mapDeleteFailure maps account deletion statuses', () => {
  assert.equal(mapDeleteFailure(0), 'network');
  assert.equal(mapDeleteFailure(401), 'wrongPassword');
  assert.equal(mapDeleteFailure(429), 'wait');
  assert.equal(mapDeleteFailure(500), 'failed');
});
