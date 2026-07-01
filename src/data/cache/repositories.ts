import {
  getDb,
  type BetRecord,
  type FavoriteRecord,
  type HistoryRecord,
  type TombstoneRecord,
  type WatchlistRecord,
} from './db';
import { scheduleSync } from '@/services/syncService';

// ---- Tombstones (so deletions propagate across devices via sync) ----
export async function listTombstones(): Promise<TombstoneRecord[]> {
  const db = await getDb();
  return db.getAll('tombstones');
}
/** Mark an id as deleted. Idempotent; bumps the deletion time. */
export async function addTombstone(kind: 'history' | 'bets', id: string): Promise<void> {
  const db = await getDb();
  await db.put('tombstones', { key: `${kind}:${id}`, id, kind, at: Date.now() });
}
/** Persist a tombstone coming from the sync layer (keeps the newest time). */
export async function putTombstone(t: TombstoneRecord): Promise<void> {
  const db = await getDb();
  await db.put('tombstones', t);
}

/** Default tombstone lifetime: 120 days. Long enough that any device syncing
 * within that window has applied the deletion; after that the marker is dropped
 * to stop unbounded growth (the record is gone everywhere by then). */
export const TOMBSTONE_TTL_MS = 120 * 24 * 60 * 60 * 1000;

/** Drop tombstones older than the TTL. Returns how many were removed. */
export async function purgeStaleTombstones(maxAgeMs = TOMBSTONE_TTL_MS): Promise<number> {
  const db = await getDb();
  const cutoff = Date.now() - maxAgeMs;
  const all = await db.getAll('tombstones');
  let removed = 0;
  for (const t of all) {
    if (t.at < cutoff) {
      await db.delete('tombstones', t.key);
      removed += 1;
    }
  }
  return removed;
}

// ---- Favorites ----
export async function listFavorites(): Promise<FavoriteRecord[]> {
  const db = await getDb();
  return (await db.getAll('favorites')).sort((a, b) => b.addedAt - a.addedAt);
}
export async function addFavorite(record: FavoriteRecord): Promise<void> {
  const db = await getDb();
  await db.put('favorites', record);
}
export async function removeFavorite(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('favorites', id);
}
export async function isFavorite(id: string): Promise<boolean> {
  const db = await getDb();
  return Boolean(await db.get('favorites', id));
}

// ---- Watchlist ----
export async function listWatchlist(): Promise<WatchlistRecord[]> {
  const db = await getDb();
  return (await db.getAll('watchlist')).sort((a, b) => b.addedAt - a.addedAt);
}
export async function addWatchlist(record: WatchlistRecord): Promise<void> {
  const db = await getDb();
  await db.put('watchlist', record);
}
export async function removeWatchlist(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('watchlist', id);
}

// ---- History ----
export async function listHistory(limit = 500): Promise<HistoryRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('history', 'createdAt');
  return all.reverse().slice(0, limit);
}
export async function addHistory(record: HistoryRecord): Promise<void> {
  const db = await getDb();
  await db.put('history', record);
  scheduleSync();
}
/** One record per fixture: updates prediction fields but keeps the existing
 * real result (`actual`) and original creation time. Once a real result is
 * recorded, the prediction is FROZEN — re-opening analysis with different
 * weights must not rewrite the probability the result was graded against
 * (that would corrupt calibration/backtest stats). */
export async function upsertHistory(record: HistoryRecord): Promise<void> {
  const db = await getDb();
  const existing = await db.get('history', record.id);
  // Union the market lists this game belongs to (BTTS / O-U / 1X2), so adding a
  // game to one market never removes it from another. Absent ⇒ legacy `['btts']`.
  const existingMarkets = existing ? (existing.trackedMarkets ?? ['btts']) : [];
  const trackedMarkets = Array.from(
    new Set([...existingMarkets, ...(record.trackedMarkets ?? [])]),
  );
  if (existing?.actual) {
    // Settled — keep the graded prediction intact, but still allow adding the
    // game to another market's list.
    if (trackedMarkets.length !== existingMarkets.length) {
      await db.put('history', { ...existing, trackedMarkets });
      scheduleSync();
    }
    return;
  }
  const merged = existing ? { ...record, createdAt: existing.createdAt } : record;
  await db.put('history', {
    ...merged,
    trackedMarkets: trackedMarkets.length ? trackedMarkets : undefined,
  });
  scheduleSync();
}
export async function clearHistory(): Promise<void> {
  const db = await getDb();
  // Tombstone every id so the clear propagates (otherwise they resurrect on the
  // next sync pull from KV).
  const ids = (await db.getAllKeys('history')) as string[];
  for (const id of ids) await addTombstone('history', id);
  await db.clear('history');
  scheduleSync();
}
/** Delete a single history record by id. */
export async function removeHistory(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('history', id);
  await addTombstone('history', id);
  scheduleSync();
}
/** Set (or clear) the real BTTS outcome (and optional final score) on a record. */
export async function setHistoryResult(
  id: string,
  actual: 'yes' | 'no' | undefined,
  actualScore?: string,
): Promise<void> {
  const db = await getDb();
  const record = await db.get('history', id);
  if (!record) return;
  // Clearing the result also clears the stored score; keep an existing score
  // when re-marking without a new one (e.g. manual SIM/NÃO).
  const score = actual === undefined ? undefined : (actualScore ?? record.actualScore);
  await db.put('history', { ...record, actual, actualScore: score });
  scheduleSync();
}

// ---- Bets (Martingale) ----
export async function listBets(): Promise<BetRecord[]> {
  const db = await getDb();
  return (await db.getAllFromIndex('bets', 'createdAt')).reverse();
}
export async function putBet(record: BetRecord): Promise<void> {
  const db = await getDb();
  await db.put('bets', record);
  scheduleSync();
}
export async function removeBet(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('bets', id);
  await addTombstone('bets', id);
  scheduleSync();
}
export async function clearBets(): Promise<void> {
  const db = await getDb();
  const ids = (await db.getAllKeys('bets')) as string[];
  for (const id of ids) await addTombstone('bets', id);
  await db.clear('bets');
  scheduleSync();
}
