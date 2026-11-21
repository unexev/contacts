import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore TS5097
import { BACKUP_FILE, downloadBackup, findBackup, multipartBody, uploadBackup } from '../utils/driveSync.ts';

/** Fake Drive: folders contacts/backups exist; `file` is the current backup (or null). */
function fakeDrive({ file = null, status = 200, folders = true } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', headers: init.headers, body: init.body });
    const u = String(url);
    const json = (body, st = status) => ({ ok: st >= 200 && st < 300, status: st, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
    if (status !== 200) return json({}, status);
    if (u.includes('alt=media')) return json('{"contacts":[]}');
    if (u.includes('mimeType%3D\'application%2Fvnd.google-apps.folder') || u.includes("google-apps.folder")) {
      return json({ files: folders ? [{ id: 'folder1' }] : [] });
    }
    if (u.includes(encodeURIComponent(`name='${BACKUP_FILE}'`))) return json({ files: file ? [file] : [] });
    return json({ id: 'new' });
  };
  return calls;
}

test('multipartBody wraps metadata and content', () => {
  const body = multipartBody('b', { name: 'x' }, '{"a":1}');
  assert.ok(body.startsWith('--b\r\n'));
  assert.ok(body.includes('{"name":"x"}'));
  assert.ok(body.includes('{"a":1}'));
  assert.ok(body.endsWith('--b--'));
});

test('uploadBackup creates the file when there is none', async () => {
  const calls = fakeDrive({ file: null });
  await uploadBackup('tok', '{"contacts":[]}');
  const create = calls.find((c) => c.method === 'POST' && c.url.includes('uploadType=multipart'));
  assert.ok(create, 'multipart create');
  assert.ok(String(create.body).includes(BACKUP_FILE));
  assert.equal(calls.some((c) => c.method === 'PATCH'), false);
});

test('uploadBackup replaces the content of the existing file', async () => {
  const calls = fakeDrive({ file: { id: 'file1', modifiedTime: '2026-01-01T00:00:00Z' } });
  await uploadBackup('tok', '{"contacts":[1]}');
  const patch = calls.find((c) => c.method === 'PATCH');
  assert.ok(patch, 'patch');
  assert.ok(patch.url.includes('/file1?uploadType=media'));
  assert.equal(patch.body, '{"contacts":[1]}');
  assert.equal(calls.some((c) => c.url.includes('uploadType=multipart')), false);
});

test('downloadBackup returns the text, and NO_BACKUP when there is none', async () => {
  fakeDrive({ file: { id: 'file1', modifiedTime: 'x' } });
  assert.equal(await downloadBackup('tok'), '{"contacts":[]}');
  fakeDrive({ file: null });
  await assert.rejects(() => downloadBackup('tok'), /NO_BACKUP/);
  fakeDrive({ folders: false });
  assert.equal(await findBackup('tok'), null);
});

test('an expired token is reported as TOKEN_EXPIRED', async () => {
  fakeDrive({ status: 401 });
  await assert.rejects(() => findBackup('tok'), /TOKEN_EXPIRED/);
});
