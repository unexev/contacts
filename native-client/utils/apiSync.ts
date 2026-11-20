/**
 * Sincronización HTTP bidireccional contra el backend de Contacts (Go).
 * Los cambios locales los registran triggers de SQLite en `sync_outbox`
 * (ver dbSchema.js); aquí se envían a /api/sync/push y se trae el delta de
 * /api/sync. Los datos locales ya usan los formatos del servidor.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "./db";
import dbSchema from "./dbSchema.js";
import { requestApi } from "./apiClient";
import { applyPulledChanges, hasPulledRows } from "./syncApply";
import { buildPushBatch, clearOutbox, settledSeqs } from "./syncPush";

const CURSOR_KEY = "contacts_sync_cursor";
/** Legacy key of the old in-memory queue; cleared on sign-out. */
const LEGACY_QUEUE_KEY = "contacts_pending_sync_queue";

/** Forget the sync cursor (used when signing out; the local database is wiped separately). */
export async function resetSyncState(): Promise<void> {
  await AsyncStorage.multiRemove([CURSOR_KEY, LEGACY_QUEUE_KEY]);
}

/** Queues every local row for upload (first sync of an account: guest data joins it). */
async function backfillOutbox(): Promise<void> {
  // Nothing has a server id yet, so no pending delete can exist: start from a clean log (retries stay idempotent).
  await db.execAsync("DELETE FROM sync_outbox");
  for (const sql of dbSchema.outboxBackfillStatements() as string[]) {
    await db.execAsync(sql);
  }
}

/** Envía los cambios pendientes, por lotes. Devuelve false si el servidor no respondió bien. */
export async function pushPendingChanges(): Promise<boolean> {
  // A hard cap keeps a misbehaving server from looping us forever.
  for (let round = 0; round < 50; round++) {
    const batch = await buildPushBatch(db);
    if (batch.items.length === 0) {
      if (batch.idleSeqs.length === 0) return true;
      await clearOutbox(db, batch.idleSeqs);
      continue;
    }

    const res = await requestApi("/api/sync/push", {
      method: "POST",
      body: JSON.stringify({ changes: batch.items }),
    });
    if (res.status !== 200 || !res.data?.results) return false;

    const settled = settledSeqs(batch, res.data.results);
    await clearOutbox(db, settled);
    // Everything in the batch failed server-side: stop instead of retrying in a tight loop.
    if (settled.length === batch.idleSeqs.length) return false;
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
  const { cursor, ...changes } = res.data;

  // Una sola transacción: si algo falla se revierte todo y el cursor no avanza,
  // así el próximo pull reintenta el mismo rango (las escrituras son idempotentes).
  try {
    await db.execAsync("BEGIN");
    try {
      await applyPulledChanges(db, changes);
      await db.execAsync("COMMIT");
    } catch (e) {
      try {
        await db.execAsync("ROLLBACK");
      } catch (_) {}
      throw e;
    }

    if (cursor) await AsyncStorage.setItem(CURSOR_KEY, String(cursor));
    return { changed: hasPulledRows(changes) };
  } catch (err: any) {
    console.warn("[apiSync] Error applying changes locally:", err);
    return { changed: false, error: err.message };
  }
}

/** Ejecuta ciclo completo: Push pendientes -> Pull nuevos del servidor */
export async function syncNow(): Promise<{ changed: boolean; error?: string }> {
  // Sin cursor es la primera sincronización de esta cuenta en este dispositivo.
  if (!(await AsyncStorage.getItem(CURSOR_KEY))) await backfillOutbox();
  const pushed = await pushPendingChanges();
  const pulled = await pullChanges();
  if (!pushed && !pulled.error) return { ...pulled, error: "Failed to push local changes" };
  return pulled;
}
