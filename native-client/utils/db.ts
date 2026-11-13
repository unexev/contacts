/**
 * Adaptador SQLite para Desktop (Tauri) y Browser (sql.js / IndexedDB).
 * En Android / iOS, Metro carga automáticamente db.native.ts (expo-sqlite).
 */
import { initializeDatabase } from './dbInit';
import { mergeSqlJsDatabases } from './dbMerge';
import dbSchema from './dbSchema.js';

const { computeSyncSignature } = dbSchema;

// Helper para detectar entorno Tauri
export function isTauri(): boolean {
  return typeof window !== 'undefined' && (Boolean((window as any).__TAURI__) || Boolean((window as any).__TAURI_INTERNALS__));
}

// plugin-sql resolves `sqlite:contacts.db` relative to appConfigDir() (tauri-plugin-sql 2.6 wrapper.rs).
const TAURI_DB_URL = 'sqlite:contacts.db';
const TAURI_DB_FILE = 'contacts.db';

let _tauriDb: any = null;
// Set while the database file is being replaced; queries wait for it to finish.
let _tauriReplacing: Promise<void> | null = null;

async function openTauriDb() {
  if (_tauriDb) return _tauriDb;
  const Database = (await import('@tauri-apps/plugin-sql')).default;
  _tauriDb = await Database.load(TAURI_DB_URL);
  return _tauriDb;
}

async function getTauriDb() {
  while (_tauriReplacing) await _tauriReplacing;
  return openTauriDb();
}

function tauriAdapter(tDb: any) {
  return {
    execAsync: (sql: string) => tDb.execute(sql),
    runAsync: (sql: string, ...p: unknown[]) => tDb.execute(sql, p),
    getAllAsync: (sql: string, ...p: unknown[]) => tDb.select(sql, p),
    getFirstAsync: async (sql: string, ...p: unknown[]) => {
      const rows = await tDb.select(sql, p);
      return rows[0] ?? null;
    },
  };
}

// ── IndexedDB persistence para fallback Web puro ───────────────
const IDB_NAME = 'contacts-app-db';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'contacts.db';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const idb = (e.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) idb.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<Uint8Array | null> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, val: Uint8Array): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(val, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── sql.js singleton ───────────────────────────────────────────
let _sqlJsPromise: Promise<any> | null = null;
let _webDb: any = null;

function getSqlJs() {
  if (!_sqlJsPromise) {
    _sqlJsPromise = (async () => {
      // Metro resolves the `browser` export of sql.js (dist/sql-wasm-browser.js) on web.
      const initSqlJs = (window as any).initSqlJs ?? (await import('sql.js')).default;
      return initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
    })();
  }
  return _sqlJsPromise;
}

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(async () => {
    if (_webDb) {
      const data = _webDb.export();
      await idbSet(IDB_KEY, data);
    }
  }, 300);
}

function sqlJsRun(webDb: any, sql: string, params: unknown[] = []) {
  const stmt = webDb.prepare(sql);
  try {
    stmt.run(params as any[]);
  } finally {
    stmt.free();
  }
}

function sqlJsGetAll<T>(webDb: any, sql: string, params: unknown[] = []): T[] {
  const stmt = webDb.prepare(sql);
  try {
    if (params.length) stmt.bind(params as any[]);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

function sqlJsGetFirst<T>(webDb: any, sql: string, params: unknown[] = []): T | null {
  const rows = sqlJsGetAll<T>(webDb, sql, params);
  return rows[0] ?? null;
}

async function getWebDb() {
  if (_webDb) return _webDb;
  const SQL = await getSqlJs();
  const saved = await idbGet(IDB_KEY);
  _webDb = saved ? new SQL.Database(saved) : new SQL.Database();
  return _webDb;
}

const _initPromise = (async () => {
  if (isTauri()) {
    await initializeDatabase(tauriAdapter(await getTauriDb()));
    return;
  }
  if (typeof window === 'undefined') return;
  const webDb = await getWebDb();
  await initializeDatabase({
    execAsync: async (sql) => { webDb.exec(sql); schedulePersist(); },
    runAsync: async (sql, ...p) => { sqlJsRun(webDb, sql, p); schedulePersist(); },
    getAllAsync: async <T>(sql: string, ...p: unknown[]) => sqlJsGetAll<T>(webDb, sql, p),
    getFirstAsync: async <T>(sql: string, ...p: unknown[]) => sqlJsGetFirst<T>(webDb, sql, p),
  });
})().catch(e => console.warn('[db.tauri/web] init error:', e));

export async function waitForDbReady(): Promise<void> {
  await _initPromise;
}

// ── File / base64 API (same exports as db.native.ts) ───────────
const SQLITE_HEADER = 'SQLite format 3\u0000';

function assertSqliteBytes(bytes: Uint8Array): void {
  const header = String.fromCharCode(...bytes.subarray(0, SQLITE_HEADER.length));
  if (header !== SQLITE_HEADER) throw new Error('The file is not a SQLite database');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sqlJsAdapter(webDb: any) {
  return {
    execAsync: async (sql: string) => { webDb.exec(sql); },
    runAsync: async (sql: string, ...p: unknown[]) => { sqlJsRun(webDb, sql, p); },
    getAllAsync: async <T>(sql: string, ...p: unknown[]) => sqlJsGetAll<T>(webDb, sql, p),
    getFirstAsync: async <T>(sql: string, ...p: unknown[]) => sqlJsGetFirst<T>(webDb, sql, p),
  };
}

function uniqueTempName(prefix: string): string {
  return `${prefix}-${Date.now()}.db`;
}

/**
 * Consistent snapshot of the Tauri database: `VACUUM INTO` a temp file in the app config dir
 * (works regardless of WAL state and open connections), then read it back with plugin-fs.
 */
async function tauriSnapshotBytes(): Promise<Uint8Array> {
  const { appConfigDir, join } = await import('@tauri-apps/api/path');
  const { BaseDirectory, readFile, remove } = await import('@tauri-apps/plugin-fs');
  const tempName = uniqueTempName('contacts-snapshot');
  const tempPath = await join(await appConfigDir(), tempName);
  const tDb = await getTauriDb();
  await tDb.execute(`VACUUM INTO '${tempPath.replace(/'/g, "''")}'`);
  try {
    return await readFile(tempName, { baseDir: BaseDirectory.AppConfig });
  } finally {
    try { await remove(tempName, { baseDir: BaseDirectory.AppConfig }); } catch (_) {}
  }
}

/** Closes the plugin-sql pool, overwrites contacts.db with `bytes`, then reopens and migrates it. */
async function tauriReplaceBytes(bytes: Uint8Array): Promise<void> {
  assertSqliteBytes(bytes);
  while (_tauriReplacing) await _tauriReplacing;
  const { BaseDirectory, exists, remove, writeFile } = await import('@tauri-apps/plugin-fs');
  const run = async () => {
    if (_tauriDb) {
      try { await _tauriDb.close(); } catch (e) { console.warn('[db] close error:', e); }
      _tauriDb = null;
    }
    const opts = { baseDir: BaseDirectory.AppConfig };
    // Stale WAL/SHM files from the old database would be replayed over the new one.
    for (const suffix of ['-wal', '-shm']) {
      try {
        if (await exists(TAURI_DB_FILE + suffix, opts)) await remove(TAURI_DB_FILE + suffix, opts);
      } catch (_) {}
    }
    await writeFile(TAURI_DB_FILE, bytes, opts);
    await initializeDatabase(tauriAdapter(await openTauriDb()));
  };
  _tauriReplacing = run();
  try {
    await _tauriReplacing;
  } finally {
    _tauriReplacing = null;
  }
}

/** Replaces the in-memory sql.js database and persists it to IndexedDB immediately. */
async function webReplaceBytes(bytes: Uint8Array): Promise<void> {
  assertSqliteBytes(bytes);
  const SQL = await getSqlJs();
  const next = new SQL.Database(bytes);
  try {
    await initializeDatabase(sqlJsAdapter(next));
  } catch (e) {
    next.close();
    throw e;
  }
  const previous = _webDb;
  _webDb = next;
  if (previous && previous !== next) {
    try { previous.close(); } catch (_) {}
  }
  await idbSet(IDB_KEY, next.export());
}

async function readDatabaseBytes(): Promise<Uint8Array> {
  if (isTauri()) return tauriSnapshotBytes();
  return (await getWebDb()).export();
}

async function writeDatabaseBytes(bytes: Uint8Array): Promise<void> {
  if (isTauri()) return tauriReplaceBytes(bytes);
  return webReplaceBytes(bytes);
}

/**
 * Desktop: writes a snapshot to `destinationPath` (an absolute path, e.g. from the save dialog).
 * Browser: downloads the database; the base name of `destinationPath` becomes the file name.
 */
export async function exportDatabaseToFile(destinationPath: string): Promise<void> {
  const bytes = await readDatabaseBytes();
  if (isTauri()) {
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(destinationPath, bytes);
    return;
  }
  const fileName = destinationPath.split(/[\\/]/).pop() || 'contacts.db';
  const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Desktop: reads `sourcePath` (an absolute path, e.g. from the open dialog).
 * Browser: `sourcePath` is a blob:/data: URI (e.g. from expo-document-picker).
 */
export async function importDatabaseFromFile(sourcePath: string): Promise<void> {
  let bytes: Uint8Array;
  if (isTauri()) {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    bytes = await readFile(sourcePath);
  } else {
    bytes = new Uint8Array(await (await fetch(sourcePath)).arrayBuffer());
  }
  await writeDatabaseBytes(bytes);
}

export async function readDatabaseAsBase64(): Promise<string> {
  return bytesToBase64(await readDatabaseBytes());
}

export async function exportDatabaseToBase64(): Promise<string> {
  return readDatabaseAsBase64();
}

export async function writeDatabaseFromBase64(base64: string): Promise<void> {
  await writeDatabaseBytes(base64ToBytes(base64));
}

/**
 * Merges a remote database by updated_at (rules in dbSchema.js via mergeSqlJsDatabases).
 * Desktop loads a snapshot of the local file into sql.js, merges there and writes the result
 * back: the shared merge rules are synchronous, which plugin-sql's async API cannot serve.
 */
export async function mergeDatabaseFromBase64(base64: string): Promise<void> {
  const remoteBytes = base64ToBytes(base64);
  assertSqliteBytes(remoteBytes);
  const SQL = await getSqlJs();
  const remoteDb = new SQL.Database(remoteBytes);
  try {
    if (isTauri()) {
      const localDb = new SQL.Database(await tauriSnapshotBytes());
      try {
        // Throws when every table fails, so the caller keeps its sync marker.
        mergeSqlJsDatabases(localDb, remoteDb);
        await tauriReplaceBytes(localDb.export());
      } finally {
        localDb.close();
      }
      return;
    }
    const localDb = await getWebDb();
    mergeSqlJsDatabases(localDb, remoteDb);
    await idbSet(IDB_KEY, localDb.export());
  } finally {
    remoteDb.close();
  }
}

export async function getDatabaseSignature(): Promise<string> {
  if (!isTauri()) {
    const webDb = await getWebDb();
    return computeSyncSignature((sql: string) => sqlJsGetFirst<{ c: number }>(webDb, sql));
  }
  // computeSyncSignature needs a synchronous lookup: collect its queries, run them, then replay.
  const queries: string[] = [];
  computeSyncSignature((sql: string) => { queries.push(sql); return null; });
  const tDb = await getTauriDb();
  const results = new Map<string, { c: number }>();
  for (const sql of queries) {
    try {
      const rows = await tDb.select(sql);
      if (rows[0]) results.set(sql, rows[0]);
    } catch (_) {
      // Missing table: left out, like computeSyncSignature does.
    }
  }
  return computeSyncSignature((sql: string) => {
    const row = results.get(sql);
    if (!row) throw new Error('missing table');
    return row;
  });
}

/** Closes the current connection and reopens it (after the file changed on disk). */
export async function reloadDatabase(): Promise<void> {
  if (isTauri()) {
    while (_tauriReplacing) await _tauriReplacing;
    if (_tauriDb) {
      try { await _tauriDb.close(); } catch (_) {}
      _tauriDb = null;
    }
    await initializeDatabase(tauriAdapter(await openTauriDb()));
    return;
  }
  const saved = await idbGet(IDB_KEY);
  if (saved) await webReplaceBytes(saved);
}

// ── DB adapter unificado ───────────────────────────────────────
export const db = {
  getAllAsync: async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
    if (isTauri()) {
      const tDb = await getTauriDb();
      return tDb.select(sql, params);
    }
    return sqlJsGetAll<T>(await getWebDb(), sql, params);
  },

  getFirstAsync: async <T>(sql: string, ...params: unknown[]): Promise<T | null> => {
    if (isTauri()) {
      const tDb = await getTauriDb();
      const rows = await tDb.select(sql, params);
      return rows[0] ?? null;
    }
    return sqlJsGetFirst<T>(await getWebDb(), sql, params);
  },

  runAsync: async (sql: string, ...params: unknown[]): Promise<void> => {
    if (isTauri()) {
      const tDb = await getTauriDb();
      await tDb.execute(sql, params);
      return;
    }
    sqlJsRun(await getWebDb(), sql, params);
    schedulePersist();
  },

  execAsync: async (sql: string): Promise<void> => {
    if (isTauri()) {
      const tDb = await getTauriDb();
      await tDb.execute(sql);
      return;
    }
    const webDb = await getWebDb();
    webDb.exec(sql);
    schedulePersist();
  },
};
