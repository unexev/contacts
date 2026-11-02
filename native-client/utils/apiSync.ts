/**
 * Sincronización HTTP bidireccional contra el backend de Contacts (Go).
 * Reemplaza driveSync.ts usando /api/sync (pull delta) y /api/sync/push (push en lote).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "./db";
import { requestApi } from "./apiClient";
import { mapContactRow } from "./syncMapping";
import { applyChildRow, CHILD_TABLES } from "./syncChildren";

const CURSOR_KEY = "contacts_sync_cursor";
const PENDING_QUEUE_KEY = "contacts_pending_sync_queue";

/** Forget the sync cursor and any queued offline changes (used when signing out). */
export async function resetSyncState(): Promise<void> {
  await AsyncStorage.multiRemove([CURSOR_KEY, PENDING_QUEUE_KEY]);
}

export interface SyncPushItem {
  entity: string;
  op: "upsert" | "delete";
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
    console.warn("[apiSync] Error enqueuing change:", e);
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
  const res = await requestApi("/api/sync/push", {
    method: "POST",
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
export async function pullChanges(): Promise<{
  changed: boolean;
  error?: string;
}> {
  const cursorStr = await AsyncStorage.getItem(CURSOR_KEY);
  const since = cursorStr ? parseInt(cursorStr, 10) : 0;

  const res = await requestApi(`/api/sync?since=${since}`);
  if (res.status !== 200 || !res.data) {
    return { changed: false, error: res.error || "Failed to pull changes" };
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

  // Aplicar cambios a la base local SQLite en una sola transacción: si algo falla se revierte
  // todo y el cursor no avanza, así el próximo pull reintenta el mismo rango (las escrituras son idempotentes).
  try {
    await db.execAsync("BEGIN");
    try {
      // 1. Contacts
      for (const c of contacts) {
        if (c.deleted) {
          for (const table of [
            "contact_phone",
            "contact_email",
            "contact_note",
          ]) {
            await db.runAsync(
              `DELETE FROM ${table} WHERE contact_id = ?`,
              c.contact_id,
            );
          }
          await db.runAsync(
            "DELETE FROM contact WHERE contact_id = ?",
            c.contact_id,
          );
        } else {
          const r = mapContactRow(c);
          await db.runAsync(
            `INSERT INTO contact (contact_id, first_name, middle_name, surname, birthdate, gender, status_id, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
             ON CONFLICT(contact_id) DO UPDATE SET
               first_name = excluded.first_name, middle_name = excluded.middle_name, surname = excluded.surname,
               birthdate = excluded.birthdate, gender = excluded.gender, status_id = excluded.status_id,
               updated_at = excluded.updated_at`,
            r.contact_id,
            r.first_name,
            r.middle_name,
            r.surname,
            r.birthdate,
            r.gender,
            r.status_id,
            r.updated_at,
          );
        }
      }

      // 2-4. Children, keyed by their server id (remote_id). Rows whose parent contact is
      // missing locally are skipped by applyChildRow (they would violate the FK).
      const pulled = { contact_phone: phones, contact_email: emails, contact_note: notes };
      for (const t of CHILD_TABLES) {
        for (const row of pulled[t.table as keyof typeof pulled]) {
          await applyChildRow(db, t, row);
        }
      }
      await db.execAsync("COMMIT");
    } catch (e) {
      try {
        await db.execAsync("ROLLBACK");
      } catch (_) {}
      throw e;
    }

    // Guardar nuevo cursor solo si todo se aplicó
    if (cursor) {
      await AsyncStorage.setItem(CURSOR_KEY, String(cursor));
    }

    const hasChanges =
      contacts.length > 0 ||
      phones.length > 0 ||
      emails.length > 0 ||
      notes.length > 0;
    return { changed: hasChanges };
  } catch (err: any) {
    console.warn("[apiSync] Error applying changes locally:", err);
    return { changed: false, error: err.message };
  }
}

/** Ejecuta ciclo completo: Push pendientes -> Pull nuevos del servidor */
export async function syncNow(): Promise<{ changed: boolean; error?: string }> {
  await pushPendingChanges();
  return await pullChanges();
}
