import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore TS5097
import { AVATAR_COLORS, AVATAR_FALLBACK, avatarColorFor, getAvatarColor } from '../utils/avatarColor.ts';

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contrastWithWhite = (hex) => 1.05 / (lum(hex) + 0.05);

test('white initials reach AA contrast on every avatar color', () => {
  for (const c of [...AVATAR_COLORS, AVATAR_FALLBACK]) {
    assert.ok(contrastWithWhite(c) >= 4.5, `${c} is ${contrastWithWhite(c).toFixed(2)}:1`);
  }
});

test('the same person always gets the same color', () => {
  assert.equal(avatarColorFor('Ana', 'Garcia'), getAvatarColor('AnaGarcia'));
  assert.equal(avatarColorFor('Ana', 'Garcia'), avatarColorFor('Ana', 'Garcia'));
  assert.equal(avatarColorFor(null, undefined), AVATAR_FALLBACK);
});
