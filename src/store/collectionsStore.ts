import { create } from 'zustand';
import type { DashboardRow } from '@/domain/types';
import {
  addFavorite,
  addWatchlist,
  listFavorites,
  listWatchlist,
  removeFavorite,
  removeWatchlist,
} from '@/data/cache/repositories';
import type { FavoriteRecord, WatchlistRecord } from '@/data/cache/db';

function toRecord(row: DashboardRow): FavoriteRecord {
  return {
    id: row.fixture.id,
    fixtureName: `${row.fixture.home.name} vs ${row.fixture.away.name}`,
    competition: row.fixture.competition.name,
    date: row.fixture.date,
    probYes: row.prediction.probYes,
    addedAt: Date.now(),
  };
}

interface CollectionsState {
  favorites: FavoriteRecord[];
  watchlist: WatchlistRecord[];
  loaded: boolean;
  refresh: () => Promise<void>;
  toggleFavorite: (row: DashboardRow) => Promise<void>;
  toggleWatchlist: (row: DashboardRow) => Promise<void>;
  isFavorite: (id: string) => boolean;
  isWatched: (id: string) => boolean;
}

export const useCollections = create<CollectionsState>((set, get) => ({
  favorites: [],
  watchlist: [],
  loaded: false,
  refresh: async () => {
    const [favorites, watchlist] = await Promise.all([listFavorites(), listWatchlist()]);
    set({ favorites, watchlist, loaded: true });
  },
  toggleFavorite: async (row) => {
    const exists = get().favorites.some((f) => f.id === row.fixture.id);
    if (exists) await removeFavorite(row.fixture.id);
    else await addFavorite(toRecord(row));
    set({ favorites: await listFavorites() });
  },
  toggleWatchlist: async (row) => {
    const exists = get().watchlist.some((w) => w.id === row.fixture.id);
    if (exists) await removeWatchlist(row.fixture.id);
    else await addWatchlist(toRecord(row));
    set({ watchlist: await listWatchlist() });
  },
  isFavorite: (id) => get().favorites.some((f) => f.id === id),
  isWatched: (id) => get().watchlist.some((w) => w.id === id),
}));
