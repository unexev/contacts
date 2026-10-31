// Small in-memory stale-while-revalidate cache. Entries live until logout or reload.
// Kept free of imports from api.svelte.js so api.svelte.js can import it without a cycle.
const entries = new Map(); // key -> { data, fetchedAt, dirty }

export const CACHE_TTL = 60_000;

export function getCached(key) {
  return entries.get(key);
}

export function setCached(key, data) {
  entries.set(key, { data, fetchedAt: Date.now(), dirty: false });
}

export function isFresh(key, ttl = CACHE_TTL) {
  const entry = entries.get(key);
  return !!entry && !entry.dirty && Date.now() - entry.fetchedAt < ttl;
}

// Marks entries stale but keeps their data, so it can still be shown while revalidating.
export function invalidate(prefix) {
  for (const [key, entry] of entries) {
    if (key.startsWith(prefix)) entry.dirty = true;
  }
}

export function clearCache() {
  entries.clear();
}
