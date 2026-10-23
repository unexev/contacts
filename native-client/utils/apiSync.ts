/**
 * Sincronización HTTP bidireccional contra el backend de Contacts (Go).
 * Reemplaza driveSync.ts usando /api/sync (pull delta) y /api/sync/push (push en lote).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './db';
import { requestApi } from './apiClient';

const CURSOR_KEY = 'contacts_sync_cursor';
const PENDING_QUEUE_KEY = 'contacts_pending_sync_queue';

export interface SyncPushItem {
  entity: string;
  op: 'upsert' | 'delete';
  id: string;
  contact_id?: string;
  data?: any;
}

/** Agrega un cambio a la cola de pendientes offline */
export async function enqueueChange(item: SyncPushItem): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    const queue: SyncPushItem[] = raw ? JSON.parse(raw) : [];
    queue.push(item);
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[apiSync] Error enqueuing change:', e);
  }
}

/** Envía cambios pendientes al backend */
export async function pushPendingChanges(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
  if (!raw) return true;
  const queue: SyncPushItem[] = JSON.parse(raw);
  if (queue.length === 0) return true;

  // Enviar de hasta 100 en 100
  const batch = queue.slice(0, 100);
  const res = await requestApi('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ changes: batch }),
  });

  if (res.status === 200 && res.data?.results) {
    // Quitar del queue los enviados
    const remaining = queue.slice(batch.length);
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
    return true;
  }
  return false;
}

/** Trae cambios del backend desde el último cursor guardado */
export async function pullChanges(): Promise<{ changed: boolean; error?: string }> {
  const cursorStr = await AsyncStorage.getItem(CURSOR_KEY);
  const since = cursorStr ? parseInt(cursorStr, 10) : 0;

  const res = await requestApi(`/api/sync?since=${since}`);
  if (res.status !== 200 || !res.data) {
    return { changed: false, error: res.error || 'Failed to pull changes' };
  }

  const {
    cursor,
    contacts = [],
    phones = [],
    emails = [],
    urls = [],
    notes = [],
    keywords = [],
    identity_cards = [],
    bank_accounts = [],
    relationships = [],
    organizations = [],
    contact_organizations = [],
    locations = [],
    nationalities = [],
  } = res.data;

  // Aplicar cambios a la base local SQLite
  try {
    // 1. Contacts
    for (const c of contacts) {
      if (c.deleted) {
        await db.runAsync('DELETE FROM contact WHERE contact_id = ?', c.contact_id);
      } else {
        await db.runAsync(
          `INSERT OR REPLACE INTO contact (contact_id, first_name, middle_name, surname, birthdate, gender, status_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          c.contact_id, c.first_name, c.middle_name || null, c.surname, c.birthdate || null, c.gender || null, c.status_id || null, c.updated_at
        );
      }
    }

    // 2. Phones
    for (const p of phones) {
      if (p.deleted) {
        await db.runAsync('DELETE FROM contact_phone WHERE contact_id = ? AND phone = ?', p.contact_id, p.phone);
      } else {
        await db.runAsync(
          `INSERT INTO contact_phone (contact_id, phone, label, updated_at)
           VALUES (?, ?, ?, ?)`,
          p.contact_id, p.phone, p.label || null, p.updated_at
        );
      }
    }

    // 3. Emails
    for (const e of emails) {
      if (e.deleted) {
        await db.runAsync('DELETE FROM contact_email WHERE contact_id = ? AND email = ?', e.contact_id, e.email);
      } else {
        await db.runAsync(
          `INSERT INTO contact_email (contact_id, email, label, updated_at)
           VALUES (?, ?, ?, ?)`,
          e.contact_id, e.email, e.label || null, e.updated_at
        );
      }
    }

    // 4. Notes
    for (const n of notes) {
      if (n.deleted) {
        await db.runAsync('DELETE FROM contact_notes WHERE note_id = ?', n.note_id);
      } else {
        await db.runAsync(
          `INSERT OR REPLACE INTO contact_notes (contact_id, note_id, note, updated_at)
           VALUES (?, ?, ?, ?)`,
          n.contact_id, n.note_id, n.note, n.updated_at
        );
      }
    }

    // Guardar nuevo cursor
    if (cursor) {
      await AsyncStorage.setItem(CURSOR_KEY, String(cursor));
    }

    const hasChanges = contacts.length > 0 || phones.length > 0 || emails.length > 0 || notes.length > 0;
    return { changed: hasChanges };
  } catch (err: any) {
    console.warn('[apiSync] Error applying changes locally:', err);
    return { changed: false, error: err.message };
  }
}

/** Ejecuta ciclo completo: Push pendientes -> Pull nuevos del servidor */
export async function syncNow(): Promise<{ changed: boolean; error?: string }> {
  await pushPendingChanges();
  return await pullChanges();
}
