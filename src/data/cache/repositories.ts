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
export async function clearHistory(): Promise<void> {
  const db = await getDb();
  await db.clear('history');
}
/** Set (or clear) the real BTTS outcome on a history record. */
export async function setHistoryResult(
  id: string,
  actual: 'yes' | 'no' | undefined,
): Promise<void> {
  const db = await getDb();
  const record = await db.get('history', id);
  if (!record) return;
  await db.put('history', { ...record, actual });
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
