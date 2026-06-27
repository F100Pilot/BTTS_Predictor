import {
  getDb,
  type BetRecord,
  type FavoriteRecord,
  type HistoryRecord,
  type WatchlistRecord,
} from './db';

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
}
/** One record per fixture: updates prediction fields but keeps the existing
 * real result (`actual`) and original creation time. Once a real result is
 * recorded, the prediction is FROZEN — re-opening analysis with different
 * weights must not rewrite the probability the result was graded against
 * (that would corrupt calibration/backtest stats). */
export async function upsertHistory(record: HistoryRecord): Promise<void> {
  const db = await getDb();
  const existing = await db.get('history', record.id);
  if (existing?.actual) return; // settled — keep the graded prediction intact
  await db.put('history', existing ? { ...record, createdAt: existing.createdAt } : record);
}
export async function clearHistory(): Promise<void> {
  const db = await getDb();
  await db.clear('history');
}
/** Delete a single history record by id. */
export async function removeHistory(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('history', id);
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
}

/**
 * Remove demo-origin records (ids starting with "mock") from history, favorites
 * and watchlist. Used when a real provider is active to purge fake games that a
 * previous demo/fallback session may have stored.
 */
export async function purgeMockData(): Promise<number> {
  const db = await getDb();
  let removed = 0;
  for (const store of ['history', 'favorites', 'watchlist'] as const) {
    const all = await db.getAll(store);
    for (const rec of all as Array<{ id: string }>) {
      if (typeof rec.id === 'string' && rec.id.startsWith('mock')) {
        await db.delete(store, rec.id);
        removed += 1;
      }
    }
  }
  return removed;
}

// ---- Bets (Martingale) ----
export async function listBets(): Promise<BetRecord[]> {
  const db = await getDb();
  return (await db.getAllFromIndex('bets', 'createdAt')).reverse();
}
export async function putBet(record: BetRecord): Promise<void> {
  const db = await getDb();
  await db.put('bets', record);
}
export async function removeBet(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('bets', id);
}
export async function clearBets(): Promise<void> {
  const db = await getDb();
  await db.clear('bets');
}
