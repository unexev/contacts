/**
 * Google Drive backup: the account's JSON export (the same document the server's
 * /api/export returns) is kept in one file, contacts/backups/contacts-backup.json.
 * Uses the drive.file scope, so the app only sees files it created itself.
 * Pure fetch code, no react-native imports, so it runs under `node --test`.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_PATH = ['contacts', 'backups'];
export const BACKUP_FILE = 'contacts-backup.json';

async function driveRequest(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...((options.headers as object) ?? {}) },
  });
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) throw new Error(`Drive error: ${res.status}`);
  return res;
}

async function driveJSON(url: string, token: string, options: RequestInit = {}): Promise<any> {
  return (await driveRequest(url, token, options)).json();
}

async function findFolder(token: string, name: string, parentId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const data = await driveJSON(`${DRIVE_API}?q=${q}&fields=files(id)`, token);
  return data.files?.[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const data = await driveJSON(DRIVE_API, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  return data.id;
}

async function getOrCreateFolderPath(token: string): Promise<string> {
  let parentId = 'root';
  for (const name of FOLDER_PATH) {
    parentId = (await findFolder(token, name, parentId)) ?? (await createFolder(token, name, parentId));
  }
  return parentId;
}

export interface BackupInfo {
  id: string;
  modifiedTime: string;
}

async function findBackupIn(token: string, folderId: string): Promise<BackupInfo | null> {
  const q = encodeURIComponent(`name='${BACKUP_FILE}' and '${folderId}' in parents and trashed=false`);
  const data = await driveJSON(`${DRIVE_API}?q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`, token);
  return data.files?.[0] ?? null;
}

/** The existing backup, or null. A missing folder means there is none. */
export async function findBackup(token: string): Promise<BackupInfo | null> {
  let parentId = 'root';
  for (const name of FOLDER_PATH) {
    const id = await findFolder(token, name, parentId);
    if (!id) return null;
    parentId = id;
  }
  return findBackupIn(token, parentId);
}

/** Multipart/related body for creating the file with its content in one request. */
export function multipartBody(boundary: string, meta: object, json: string): string {
  return (
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
  );
}

/** Saves the backup, replacing the previous one. */
export async function uploadBackup(token: string, json: string): Promise<void> {
  const folderId = await getOrCreateFolderPath(token);
  const existing = await findBackupIn(token, folderId);
  if (existing) {
    await driveRequest(`${DRIVE_UPLOAD}/${existing.id}?uploadType=media`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });
    return;
  }
  const boundary = 'contacts_boundary';
  await driveRequest(`${DRIVE_UPLOAD}?uploadType=multipart`, token, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipartBody(boundary, { name: BACKUP_FILE, mimeType: 'application/json', parents: [folderId] }, json),
  });
}

/** The backup's text. Throws NO_BACKUP when there is none. */
export async function downloadBackup(token: string): Promise<string> {
  const backup = await findBackup(token);
  if (!backup) throw new Error('NO_BACKUP');
  return (await driveRequest(`${DRIVE_API}/${backup.id}?alt=media`, token)).text();
}
