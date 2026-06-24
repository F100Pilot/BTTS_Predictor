import { getDb } from './db';
import { createLogger } from '@/services/logger';

const log = createLogger('cache');

/** TTL presets (ms) by data volatility. */
export const TTL = {
  fixtures: 1000 * 60 * 30, // 30 min — schedules change rarely intraday
  teamHistory: 1000 * 60 * 60 * 12, // 12h — past results are stable
  h2h: 1000 * 60 * 60 * 24, // 24h
} as const;

/** In-flight request de-duplication: same key resolves to the same promise. */
const inflight = new Map<string, Promise<unknown>>();

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await getDb();
    const record = await db.get('cache', key);
    if (!record) return undefined;
    if (record.expiresAt < Date.now()) {
      await db.delete('cache', key);
      return undefined;
    }
    return record.value as T;
  } catch (err) {
    log.warn('cacheGet failed', err);
    return undefined;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  try {
    const db = await getDb();
    await db.put('cache', { key, value, expiresAt: Date.now() + ttlMs });
  } catch (err) {
    log.warn('cacheSet failed', err);
  }
}

/**
 * Cache-aside helper with in-flight de-duplication.
 * Returns cached value if fresh, otherwise runs `loader`, caches and returns it.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) {
    log.debug('cache hit', key);
    return hit;
  }
  if (inflight.has(key)) {
    log.debug('cache inflight join', key);
    return inflight.get(key) as Promise<T>;
  }
  const promise = (async () => {
    try {
      const value = await loader();
      await cacheSet(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

/** Remove expired records (best-effort housekeeping). */
export async function purgeExpired(): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('cache', 'readwrite');
    const index = tx.store.index('expiresAt');
    const now = Date.now();
    let cursor = await index.openCursor(IDBKeyRange.upperBound(now));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (err) {
    log.warn('purgeExpired failed', err);
  }
}

export async function clearCache(): Promise<void> {
  const db = await getDb();
  await db.clear('cache');
}
