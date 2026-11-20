'use strict';

const createTablesSql = `
  CREATE TABLE IF NOT EXISTS marital_status (
    status_id TEXT PRIMARY KEY,
    marital_status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contact (
    contact_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    surname TEXT NOT NULL,
    birthdate TEXT,
    gender TEXT CHECK(gender IN ('MALE', 'FEMALE')),
    status_id TEXT,
    relationship_status TEXT CHECK(relationship_status IN ('SINGLE', 'PARTNERED', 'COHABITING')),
    children_count INTEGER CHECK(children_count >= 0),
    deceased INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (status_id) REFERENCES marital_status (status_id)
  );

  CREATE TABLE IF NOT EXISTS contact_phone (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    label TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  );

  CREATE TABLE IF NOT EXISTS contact_email (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    email TEXT NOT NULL,
    label TEXT,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  );

  CREATE TABLE IF NOT EXISTS national_identity_card (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    card_number TEXT NOT NULL,
    issue_date TEXT,
    expiry_date TEXT,
    country_code TEXT,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact (contact_id)
  );

  CREATE TABLE IF NOT EXISTS relationship_type (
    type_id TEXT PRIMARY KEY,
    label TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contact_relationship (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    related_contact_id TEXT NOT NULL,
    type_id TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id),
    FOREIGN KEY (related_contact_id) REFERENCES contact(contact_id),
    FOREIGN KEY (type_id) REFERENCES relationship_type(type_id),
    UNIQUE(contact_id, related_contact_id, type_id)
  );

  CREATE TABLE IF NOT EXISTS organization (
    organization_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS contact_organization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    achievement TEXT NOT NULL,
    date TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id),
    FOREIGN KEY (organization_id) REFERENCES organization(organization_id)
  );

  CREATE TABLE IF NOT EXISTS contact_keyword (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    UNIQUE(contact_id, keyword),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  );

  CREATE TABLE IF NOT EXISTS contact_note (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    note TEXT NOT NULL,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  );

  CREATE TABLE IF NOT EXISTS contact_url (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    url TEXT NOT NULL,
    label TEXT,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  );

  CREATE TABLE IF NOT EXISTS contact_bank_account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    bank_name TEXT,
    account_number TEXT NOT NULL,
    account_type TEXT,
    label TEXT,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  );

  CREATE TABLE IF NOT EXISTS contact_location (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    location_type TEXT NOT NULL DEFAULT '',
    address TEXT,
    city TEXT,
    region TEXT,
    country TEXT,
    postal_code TEXT,
    latitude REAL,
    longitude REAL,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  );

  CREATE TABLE IF NOT EXISTS contact_nationality (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    country_code TEXT NOT NULL,
    acquired_at TEXT,
    note TEXT,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  );

  -- Local changes waiting to be sent to the backend (filled by triggers, see OUTBOX_TABLES).
  CREATE TABLE IF NOT EXISTS sync_outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    local_key TEXT NOT NULL,
    remote_key TEXT,
    contact_id TEXT,
    op TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_state (k TEXT PRIMARY KEY, v INTEGER NOT NULL);

  CREATE INDEX IF NOT EXISTS idx_contact_phone_contact ON contact_phone(contact_id);
  CREATE INDEX IF NOT EXISTS idx_contact_email_contact ON contact_email(contact_id);
  CREATE INDEX IF NOT EXISTS idx_contact_note_contact ON contact_note(contact_id);
  CREATE INDEX IF NOT EXISTS idx_contact_url_contact ON contact_url(contact_id);
  CREATE INDEX IF NOT EXISTS idx_contact_keyword_contact ON contact_keyword(contact_id);
  CREATE INDEX IF NOT EXISTS idx_contact_keyword_keyword ON contact_keyword(keyword);
  CREATE INDEX IF NOT EXISTS idx_identity_card_contact ON national_identity_card(contact_id);
  CREATE INDEX IF NOT EXISTS idx_contact_org_contact ON contact_organization(contact_id);
  CREATE INDEX IF NOT EXISTS idx_contact_org_org ON contact_organization(organization_id);
  CREATE INDEX IF NOT EXISTS idx_contact_bank_contact ON contact_bank_account(contact_id);
  CREATE INDEX IF NOT EXISTS idx_contact_relationship_contact ON contact_relationship(contact_id);
  CREATE INDEX IF NOT EXISTS idx_contact_relationship_related ON contact_relationship(related_contact_id);
  CREATE INDEX IF NOT EXISTS idx_organization_name ON organization(name);
`;

/**
 * Migraciones para bases de datos existentes.
 * Usar CREATE TABLE IF NOT EXISTS o ALTER TABLE según corresponda.
 * Deben ser idempotentes (fallar silenciosamente si ya están aplicadas).
 */
const migrationsSql = [
  "ALTER TABLE contact ADD COLUMN birthdate TEXT",
  "ALTER TABLE contact ADD COLUMN gender TEXT CHECK(gender IN ('MALE', 'FEMALE'))",
  "ALTER TABLE national_identity_card ADD COLUMN issue_date TEXT",
  "ALTER TABLE national_identity_card ADD COLUMN expiry_date TEXT",
  `CREATE TABLE IF NOT EXISTS contact_bank_account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    bank_name TEXT,
    account_number TEXT NOT NULL,
    account_type TEXT,
    label TEXT,
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  )`,
  // Locations and nationalities arrived after the first release (they sync with the server)
  `CREATE TABLE IF NOT EXISTS contact_location (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    location_type TEXT NOT NULL DEFAULT '',
    address TEXT,
    city TEXT,
    region TEXT,
    country TEXT,
    postal_code TEXT,
    latitude REAL,
    longitude REAL,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  )`,
  `CREATE TABLE IF NOT EXISTS contact_nationality (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT NOT NULL,
    country_code TEXT NOT NULL,
    acquired_at TEXT,
    note TEXT,
    remote_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
  )`,
  "ALTER TABLE contact ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE contact_phone ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE contact_email ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE national_identity_card ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE contact_relationship ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE contact_organization ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE contact_note ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE contact_url ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE contact_bank_account ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  // Server ids of synced children, so pulled edits update rows instead of duplicating them
  "ALTER TABLE contact_phone ADD COLUMN remote_id TEXT",
  "ALTER TABLE contact_email ADD COLUMN remote_id TEXT",
  "ALTER TABLE contact_note ADD COLUMN remote_id TEXT",
  // Server ids for the remaining synced children (phone/email/note already have one)
  "ALTER TABLE contact_phone ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE contact_url ADD COLUMN remote_id TEXT",
  "ALTER TABLE national_identity_card ADD COLUMN remote_id TEXT",
  "ALTER TABLE contact_bank_account ADD COLUMN remote_id TEXT",
  "ALTER TABLE national_identity_card ADD COLUMN country_code TEXT",
  "ALTER TABLE contact ADD COLUMN deceased INTEGER NOT NULL DEFAULT 0",
  // Real-life situation, independent of the legal status_id; NULL means unknown
  "ALTER TABLE contact ADD COLUMN relationship_status TEXT CHECK(relationship_status IN ('SINGLE', 'PARTNERED', 'COHABITING'))",
  'ALTER TABLE contact ADD COLUMN children_count INTEGER CHECK(children_count >= 0)',
  // Se eliminó la búsqueda full-text: borrar sus triggers e índice de DBs existentes
  'DROP TRIGGER IF EXISTS contact_ai',
  'DROP TRIGGER IF EXISTS contact_ad',
  'DROP TRIGGER IF EXISTS contact_au',
  'DROP TABLE IF EXISTS contact_fts',
];

/**
 * Unique indexes on the server id of synced children. They must run after
 * `migrationsSql`: legacy databases only get `remote_id` through ALTER TABLE,
 * so putting them in `createTablesSql` would fail there. NULL remote ids stay
 * allowed many times (SQLite treats NULLs as distinct in unique indexes).
 */
const remoteIdIndexesSql = [
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_phone_remote ON contact_phone(contact_id, remote_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_email_remote ON contact_email(contact_id, remote_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_note_remote ON contact_note(contact_id, remote_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_url_remote ON contact_url(contact_id, remote_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_card_remote ON national_identity_card(contact_id, remote_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_bank_remote ON contact_bank_account(contact_id, remote_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_location_remote ON contact_location(contact_id, remote_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_nationality_remote ON contact_nationality(contact_id, remote_id)',
];

// ── Sync outbox ──────────────────────────────────────────────────────────────
// Triggers record every local change in `sync_outbox`; the push step turns the
// pending entries into /api/sync/push items. While `sync_state.applying` is 1
// (pull in progress, id write-back) the triggers stay silent.

const OUTBOX_TABLES = [
  { table: 'contact', entity: 'contact', key: 'contact_id', contact: 'contact_id', remote: 'contact_id', hasRemoteId: false },
  { table: 'contact_phone', entity: 'phone', key: 'id', contact: 'contact_id', remote: 'remote_id', hasRemoteId: true },
  { table: 'contact_email', entity: 'email', key: 'id', contact: 'contact_id', remote: 'remote_id', hasRemoteId: true },
  { table: 'contact_note', entity: 'note', key: 'id', contact: 'contact_id', remote: 'remote_id', hasRemoteId: true },
  { table: 'contact_url', entity: 'url', key: 'id', contact: 'contact_id', remote: 'remote_id', hasRemoteId: true },
  { table: 'national_identity_card', entity: 'card', key: 'id', contact: 'contact_id', remote: 'remote_id', hasRemoteId: true },
  { table: 'contact_bank_account', entity: 'bank_account', key: 'id', contact: 'contact_id', remote: 'remote_id', hasRemoteId: true },
  { table: 'contact_location', entity: 'location', key: 'id', contact: 'contact_id', remote: 'remote_id', hasRemoteId: true },
  { table: 'contact_nationality', entity: 'nationality', key: 'id', contact: 'contact_id', remote: 'remote_id', hasRemoteId: true },
  { table: 'contact_keyword', entity: 'keyword', key: 'keyword', contact: 'contact_id', remote: 'keyword', hasRemoteId: false },
  { table: 'contact_relationship', entity: 'relationship', key: ['related_contact_id', 'type_id'], contact: 'contact_id', remote: 'related_contact_id', hasRemoteId: false },
  { table: 'contact_organization', entity: 'contact_organization', key: 'organization_id', contact: 'contact_id', remote: 'organization_id', hasRemoteId: false },
  { table: 'organization', entity: 'organization', key: 'organization_id', contact: null, remote: 'organization_id', hasRemoteId: false },
];

function keyExpr(t, ref) {
  const cols = Array.isArray(t.key) ? t.key : [t.key];
  return cols.map((c) => `${ref}.${c}`).join(" || '|' || ");
}

/** One statement per trigger (the adapters run them one by one). */
function outboxTriggerStatements() {
  const idle = "(SELECT v FROM sync_state WHERE k = 'applying') = 0";
  const out = [];
  for (const t of OUTBOX_TABLES) {
    const contactNew = t.contact ? `NEW.${t.contact}` : 'NULL';
    const contactOld = t.contact ? `OLD.${t.contact}` : 'NULL';
    const insert = (ref, contact, op) =>
      `INSERT INTO sync_outbox (entity, local_key, remote_key, contact_id, op) VALUES ('${t.entity}', ${keyExpr(t, ref)}, ${ref}.${t.remote}, ${contact}, '${op}');`;
    out.push(`CREATE TRIGGER IF NOT EXISTS ob_${t.table}_ins AFTER INSERT ON ${t.table} WHEN ${idle} BEGIN ${insert('NEW', contactNew, 'upsert')} END`);
    out.push(`CREATE TRIGGER IF NOT EXISTS ob_${t.table}_upd AFTER UPDATE ON ${t.table} WHEN ${idle} BEGIN ${insert('NEW', contactNew, 'upsert')} END`);
    // Rows that never reached the server have nothing to delete there.
    const delWhen = t.hasRemoteId ? `${idle} AND OLD.remote_id IS NOT NULL` : idle;
    out.push(`CREATE TRIGGER IF NOT EXISTS ob_${t.table}_del AFTER DELETE ON ${t.table} WHEN ${delWhen} BEGIN ${insert('OLD', contactOld, 'delete')} END`);
  }
  return out;
}

/**
 * Statements that queue every local row for upload: used on the first sync of
 * an account, so data created before signing in (guest mode) reaches the server.
 */
function outboxBackfillStatements() {
  return OUTBOX_TABLES.map((t) => {
    const key = (Array.isArray(t.key) ? t.key : [t.key]).join(" || '|' || ");
    const contact = t.contact ?? 'NULL';
    const where = t.hasRemoteId ? ' WHERE remote_id IS NULL' : '';
    return `INSERT INTO sync_outbox (entity, local_key, remote_key, contact_id, op) SELECT '${t.entity}', ${key}, ${t.remote}, ${contact}, 'upsert' FROM ${t.table}${where}`;
  });
}

const outboxSeedSql = "INSERT OR IGNORE INTO sync_state (k, v) VALUES ('applying', 0)";

// ── Data normalization ───────────────────────────────────────────────────────
// Local data follows the backend's conventions: ISO dates and doc_type codes.
// These statements upgrade rows written by older versions (or merged from an
// old backup) and are idempotent, so they run on every initialization.
const ISO_DATE_COLUMNS = [
  ['contact', 'birthdate'],
  ['national_identity_card', 'issue_date'],
  ['national_identity_card', 'expiry_date'],
  ['contact_organization', 'date'],
];

const LEGACY_DOC_TYPES = {
  national_id: ['Cédula', 'Cedula', 'ID Card'],
  passport: ['Pasaporte', 'Passport'],
  drivers_license: ['Licencia de conducir', "Driver's License"],
  other: ['Other', 'Otro'],
};

const PHONE_LABELS = ['Personal', 'Trabajo', 'Casa', 'Otro'];

function normalizeDataStatements() {
  const out = ISO_DATE_COLUMNS.map(([table, col]) =>
    `UPDATE ${table} SET ${col} = substr(${col}, 7, 4) || '-' || substr(${col}, 4, 2) || '-' || substr(${col}, 1, 2) WHERE ${col} LIKE '__/__/____'`);
  for (const [code, legacy] of Object.entries(LEGACY_DOC_TYPES)) {
    const list = legacy.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
    out.push(`UPDATE national_identity_card SET doc_type = '${code}' WHERE doc_type IN (${list})`);
  }
  // Phone labels: stored as the canonical word whatever the case they were typed in.
  for (const label of PHONE_LABELS) {
    out.push(`UPDATE contact_phone SET label = '${label}' WHERE lower(label) = '${label.toLowerCase()}' AND label <> '${label}'`);
  }
  return out;
}

const seedSql = `
  INSERT OR IGNORE INTO marital_status (status_id, marital_status) VALUES
    ('soltero', 'Soltero/a'),('casado', 'Casado/a'),('divorciado', 'Divorciado/a'),
    ('viudo', 'Viudo/a'),('union_libre', 'Unión libre'),('separado', 'Separado/a');

  INSERT OR IGNORE INTO relationship_type (type_id, label) VALUES
    ('padre','Padre'),('madre','Madre'),('hijo','Hijo'),('hija','Hija'),
    ('hermano','Hermano'),('hermana','Hermana'),('tio','Tío'),('tia','Tía'),
    ('sobrino','Sobrino'),('sobrina','Sobrina'),('abuelo','Abuelo'),('abuela','Abuela'),
    ('primo','Primo'),('prima','Prima'),('conyuge','Cónyuge'),('nieto','Nieto'),('nieta','Nieta');
`;

/**
 * Tables that take part in cross-device sync (content signature).
 * Single source of truth for db.ts and db.native.ts.
 */
const SYNC_TABLES = [
  'contact', 'contact_phone', 'contact_email', 'contact_note',
  'contact_url', 'contact_bank_account', 'contact_relationship',
  'contact_keyword', 'national_identity_card', 'contact_organization',
  'contact_location', 'contact_nationality',
];

// ── Gender migration ─────────────────────────────────────────────────────────
// Legacy databases declared `gender CHECK(gender IN ('male', 'female'))`.
// The migration rebuilds `contact` with uppercase values and the new CHECK.
// Foreign-key toggling and error handling stay with each adapter.

/**
 * @param {string | null | undefined} contactTableSql `sqlite_master.sql` of the `contact` table.
 * @returns {boolean}
 */
function needsGenderMigration(contactTableSql) {
  return !!contactTableSql && contactTableSql.includes("'male'");
}

/**
 * Statements that rebuild `contact` with uppercase gender values.
 * The legacy desktop adapter rebuilt the table without `updated_at`; every adapter
 * now keeps it, like utils/dbInit.ts. `keepUpdatedAt: true` requires the column to exist.
 * @param {{ keepUpdatedAt: boolean }} options
 * @returns {string[]}
 */
function genderMigrationStatements({ keepUpdatedAt }) {
  const updatedAtColumn = keepUpdatedAt ? "\n        updated_at TEXT DEFAULT (datetime('now'))," : '';
  const updatedAtSelect = keepUpdatedAt ? ', updated_at' : '';
  return [
    'DROP TABLE IF EXISTS contact_gender_tmp',
    `CREATE TABLE contact_gender_tmp (
        contact_id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        middle_name TEXT,
        surname TEXT NOT NULL,
        birthdate TEXT,
        gender TEXT CHECK(gender IN ('MALE', 'FEMALE')),
        status_id TEXT,${updatedAtColumn}
        FOREIGN KEY (status_id) REFERENCES marital_status (status_id)
      )`,
    `INSERT INTO contact_gender_tmp
         SELECT contact_id, first_name, middle_name, surname, birthdate, UPPER(gender), status_id${updatedAtSelect}
         FROM contact`,
    'DROP TABLE contact',
    'ALTER TABLE contact_gender_tmp RENAME TO contact',
  ];
}

// ── Drive merge rules ────────────────────────────────────────────────────────
// Single source of truth for the updated_at merge used by every adapter:
// sql.js (utils/dbMerge.ts) and expo-sqlite (utils/db.native.ts).
// Adapters only provide engine access.

/**
 * Tables merged on Drive pull, in merge order.
 * Known gap: `contact_keyword` is in SYNC_TABLES but is not merged.
 */
const MERGE_TABLES = [
  'contact', 'contact_phone', 'contact_email', 'contact_note',
  'contact_url', 'contact_bank_account', 'contact_relationship',
  'national_identity_card', 'contact_organization',
];

/**
 * Statements that add a nullable `updated_at` to merge tables that lack it.
 * Legacy DBs may miss the column (the `migrationsSql` ADD COLUMN uses a
 * non-constant default, which SQLite rejects). NULL means "unknown age", so
 * the remote row wins on the next merge, matching `shouldTakeRemoteRow`.
 * @param {(table: string) => string[]} columnsOf Column names of a local table.
 * @returns {string[]}
 */
function missingUpdatedAtStatements(columnsOf) {
  return MERGE_TABLES
    .filter(table => !columnsOf(table).includes('updated_at'))
    .map(table => `ALTER TABLE ${table} ADD COLUMN updated_at TEXT`);
}

/** @typedef {Record<string, unknown>} Row */

/**
 * @typedef {Object} MergeTableCursor
 * @property {Iterable<Row>} remoteRows Rows of the table in the remote database.
 * @property {(id: unknown) => unknown} localUpdatedAt `updated_at` of the local row with that id, or null/undefined when missing.
 * @property {() => void} [close] Releases engine resources once the table is done.
 */

/**
 * @typedef {Object} MergeTarget
 * @property {(table: string, idColumn: string) => MergeTableCursor} openTable
 * @property {(sql: string, params: unknown[]) => void} run Executes a write on the local database.
 * @property {(row: Row) => void} [writeContact] Overrides the default `contact` upsert.
 */

/**
 * @typedef {Object} MergeResult
 * @property {number} mergedRows
 * @property {string[]} failedTables
 */

/** @param {string} table */
function mergeIdColumn(table) {
  return table === 'contact' ? 'contact_id' : 'id';
}

/**
 * The remote row wins when the local row is missing, either side has no
 * timestamp, or the remote timestamp is strictly newer.
 * @param {unknown} localUpdatedAt
 * @param {unknown} remoteUpdatedAt
 */
function shouldTakeRemoteRow(localUpdatedAt, remoteUpdatedAt) {
  return !localUpdatedAt || !remoteUpdatedAt
    || /** @type {string} */ (remoteUpdatedAt) > /** @type {string} */ (localUpdatedAt);
}

/**
 * @param {MergeTarget} target
 * @param {string} table
 * @param {string} idColumn
 * @param {Row} row
 */
function writeRemoteRow(target, table, idColumn, row) {
  const columns = Object.keys(row).filter(c => c !== 'rowid');
  const placeholders = columns.map(() => '?').join(',');
  const values = columns.map(c => row[c]);

  if (table === 'contact') {
    if (target.writeContact) {
      target.writeContact(row);
      return;
    }
    const updateSet = columns
      .filter(c => c !== idColumn)
      .map(c => `${c} = excluded.${c}`)
      .join(', ');
    target.run(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})
      ON CONFLICT(${idColumn}) DO UPDATE SET ${updateSet}`, values);
    return;
  }

  // Child tables: replace the row by id.
  target.run(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [row[idColumn]]);
  target.run(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`, values);
}

/**
 * Merges remote rows into the local database table by table.
 * Per-table errors are logged and reported in `failedTables`; when every table
 * fails it throws, so callers never treat the pull as a successful sync.
 * Foreign-key toggling and transactions stay with each adapter.
 * @param {MergeTarget} target
 * @returns {MergeResult}
 */
function mergeRemoteRows(target) {
  /** @type {MergeResult} */
  const result = { mergedRows: 0, failedTables: [] };

  for (const table of MERGE_TABLES) {
    const idColumn = mergeIdColumn(table);
    try {
      const cursor = target.openTable(table, idColumn);
      try {
        for (const row of cursor.remoteRows) {
          if (!shouldTakeRemoteRow(cursor.localUpdatedAt(row[idColumn]), row.updated_at)) continue;
          writeRemoteRow(target, table, idColumn, row);
          result.mergedRows++;
        }
      } finally {
        if (cursor.close) cursor.close();
      }
    } catch (e) {
      console.warn(`[merge] ${table}:`, e);
      result.failedTables.push(table);
    }
  }

  if (result.failedTables.length === MERGE_TABLES.length) {
    throw new Error(`[merge] all tables failed: ${result.failedTables.join(', ')}`);
  }
  return result;
}

/**
 * Content signature used to avoid sync ping-pong: total row count of SYNC_TABLES.
 * Tables that cannot be counted (e.g. missing) are skipped.
 * @param {(sql: string) => { c: number } | null | undefined} getFirst
 * @returns {string}
 */
function computeSyncSignature(getFirst) {
  let total = 0;
  for (const table of SYNC_TABLES) {
    try {
      const row = getFirst(`SELECT COUNT(*) c FROM ${table}`);
      if (row) total += row.c;
    } catch (_) {
      // Missing table: not part of the signature.
    }
  }
  return String(total);
}

module.exports = {
  createTablesSql,
  normalizeDataStatements,
  OUTBOX_TABLES,
  outboxTriggerStatements,
  outboxSeedSql,
  outboxBackfillStatements,
  migrationsSql,
  remoteIdIndexesSql,
  seedSql,
  SYNC_TABLES,
  needsGenderMigration,
  genderMigrationStatements,
  MERGE_TABLES,
  missingUpdatedAtStatements,
  mergeIdColumn,
  shouldTakeRemoteRow,
  mergeRemoteRows,
  computeSyncSignature,
};
