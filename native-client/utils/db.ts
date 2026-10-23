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

let _tauriDb: any = null;

async function getTauriDb() {
  if (_tauriDb) return _tauriDb;
  const Database = (await import('@tauri-apps/plugin-sql')).default;
  _tauriDb = await Database.load('sqlite:contacts.db');
  return _tauriDb;
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
    _sqlJsPromise = (window as any).initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
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
    const tDb = await getTauriDb();
    await initializeDatabase({
      execAsync: (sql) => tDb.execute(sql),
      runAsync: (sql, ...p) => tDb.execute(sql, p),
      getAllAsync: (sql, ...p) => tDb.select(sql, p),
      getFirstAsync: async (sql, ...p) => {
        const rows = await tDb.select(sql, p);
        return rows[0] ?? null;
      },
    });
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
