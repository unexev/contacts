import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_MAX_BYTES, validatePhotoFile, mapPhotoFailure, photoUrlFrom, photoUrlsFrom, contactInitials, photoCacheKey } from '../utils/photoApi.ts';

test('validatePhotoFile accepts JPEG, PNG and WebP up to 2 MB', () => {
  for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(validatePhotoFile({ mimeType, size: 1000 }), null, mimeType);
  }
  assert.equal(validatePhotoFile({ mimeType: 'image/png', size: PHOTO_MAX_BYTES }), null);
});

test('validatePhotoFile rejects other types and big files', () => {
  assert.equal(validatePhotoFile({ mimeType: 'image/gif', size: 10 }), 'type');
  assert.equal(validatePhotoFile({ mimeType: 'application/pdf', size: 10 }), 'type');
  assert.equal(validatePhotoFile({ mimeType: undefined, size: 10 }), 'type');
  assert.equal(validatePhotoFile({ mimeType: 'image/jpeg', size: PHOTO_MAX_BYTES + 1 }), 'size');
});

test('validatePhotoFile lets the server decide when the size is unknown', () => {
  assert.equal(validatePhotoFile({ mimeType: 'image/jpeg' }), null);
});

test('mapPhotoFailure turns statuses into error keys', () => {
  assert.equal(mapPhotoFailure(0), 'network');
  assert.equal(mapPhotoFailure(400), 'type');
  assert.equal(mapPhotoFailure(404), 'syncFirst');
  assert.equal(mapPhotoFailure(413), 'size');
  assert.equal(mapPhotoFailure(503), 'unavailable');
  assert.equal(mapPhotoFailure(500), 'failed');
});

test('photoUrlFrom reads photo_url only when it is an http(s) URL', () => {
  assert.equal(photoUrlFrom({ photo_url: 'https://x.test/a.jpg?t=1' }), 'https://x.test/a.jpg?t=1');
  for (const v of [null, undefined, {}, { photo_url: '' }, { photo_url: 'javascript:alert(1)' }, { photo_url: 5 }]) {
    assert.equal(photoUrlFrom(v), null, JSON.stringify(v));
  }
});

test('contactInitials uses the first letters of first name and surname', () => {
  assert.equal(contactInitials('ana', 'garcía'), 'AG');
  assert.equal(contactInitials('  ', 'Lee'), 'L');
  assert.equal(contactInitials('', ''), '?');
});

test('photoUrlsFrom maps contact ids to web URLs and skips the rest', () => {
  const urls = photoUrlsFrom([
    { contact_id: 'a', photo_url: 'https://cdn.example/a.jpg?sig=1' },
    { contact_id: 'b' },
    { contact_id: 'c', photo_url: 'javascript:alert(1)' },
    { photo_url: 'https://cdn.example/x.jpg' },
    null,
  ]);
  assert.deepEqual(urls, { a: 'https://cdn.example/a.jpg?sig=1' });
  assert.deepEqual(photoUrlsFrom(undefined), {});
  assert.deepEqual(photoUrlsFrom({ photo_url: 'https://x' }), {});
});

test('photoCacheKey ignores the signed token', () => {
  assert.equal(
    photoCacheKey('https://x.supabase.co/storage/v1/object/sign/photos/u/c.jpg?token=abc'),
    photoCacheKey('https://x.supabase.co/storage/v1/object/sign/photos/u/c.jpg?token=def'),
  );
});
