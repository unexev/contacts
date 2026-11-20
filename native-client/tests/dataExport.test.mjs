import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exportFileName, exportedContactCount, parseExportFile, importCounts, mapDataFailure, InvalidExportFile,
} from '../utils/dataExport.ts';

const doc = { format: 'contacts-export', version: 1, data: { contacts: [{}, {}] } };

test('the file name carries the date', () => {
  assert.equal(exportFileName(new Date('2026-11-20T15:00:00Z')), 'contacts-export-2026-11-20.json');
});

test('exportedContactCount counts contacts and tolerates other shapes', () => {
  assert.equal(exportedContactCount(doc), 2);
  assert.equal(exportedContactCount({}), 0);
  assert.equal(exportedContactCount(null), 0);
  assert.equal(exportedContactCount({ data: { contacts: 'x' } }), 0);
});

test('parseExportFile accepts an export and rejects everything else', () => {
  assert.deepEqual(parseExportFile(JSON.stringify(doc)), doc);
  for (const bad of ['not json', '[]', 'null', '{}', JSON.stringify({ ...doc, format: 'other' }),
    JSON.stringify({ ...doc, version: '1' }), JSON.stringify({ format: 'contacts-export', version: 1 })]) {
    assert.throws(() => parseExportFile(bad), InvalidExportFile, bad);
  }
});

test('importCounts reads the server answer', () => {
  assert.deepEqual(importCounts({ contacts: { created: 3, updated: 1, skipped: 2 } }), { created: 3, updated: 1, skipped: 2 });
  assert.deepEqual(importCounts({ created: 1 }), { created: 1, updated: 0, skipped: 0 });
  assert.deepEqual(importCounts(undefined), { created: 0, updated: 0, skipped: 0 });
});

test('mapDataFailure maps statuses', () => {
  assert.equal(mapDataFailure(0), 'network');
  assert.equal(mapDataFailure(400), 'invalid');
  assert.equal(mapDataFailure(413), 'tooLarge');
  assert.equal(mapDataFailure(500), 'failed');
  assert.equal(mapDataFailure(401), 'failed');
});
