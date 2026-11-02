import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../utils/dbSchema.js';
import { USER_DATA_TABLES, REFERENCE_TABLES, buildLocalDataResetStatements } from '../utils/localDataReset.ts';

const created = [...schema.createTablesSql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);

test('every schema table is classified as user data or reference data', () => {
  assert.ok(created.length > 0);
  for (const t of created) {
    assert.ok(USER_DATA_TABLES.includes(t) || REFERENCE_TABLES.includes(t), `unclassified table: ${t}`);
  }
});

test('no table is both user data and reference data', () => {
  for (const t of USER_DATA_TABLES) assert.ok(!REFERENCE_TABLES.includes(t), t);
});

test('lists only contain tables that exist in the schema', () => {
  for (const t of [...USER_DATA_TABLES, ...REFERENCE_TABLES]) assert.ok(created.includes(t), t);
});

test('child tables are deleted before the parents they reference', () => {
  const order = buildLocalDataResetStatements();
  const idx = (t) => order.indexOf(`DELETE FROM ${t}`);
  for (const t of USER_DATA_TABLES) assert.ok(idx(t) >= 0, `missing delete for ${t}`);
  // parse "CREATE TABLE x (... REFERENCES y ...)" blocks
  for (const block of schema.createTablesSql.split(/CREATE TABLE IF NOT EXISTS /).slice(1)) {
    const child = block.match(/^(\w+)/)[1];
    for (const m of block.matchAll(/REFERENCES\s+(\w+)/g)) {
      const parent = m[1];
      if (parent === child || !USER_DATA_TABLES.includes(parent)) continue;
      assert.ok(idx(child) < idx(parent), `${child} must be deleted before ${parent}`);
    }
  }
});

test('statements never touch reference tables', () => {
  for (const s of buildLocalDataResetStatements()) {
    for (const t of REFERENCE_TABLES) assert.ok(!s.includes(t), s);
  }
});
