import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Bet } from '@/domain/types';

/** Persisted bet record (Martingale system). */
export type BetRecord = Bet;

export interface CacheRecord {
  key: string;
  value: unknown;
  expiresAt: number; // epoch ms
}

export interface FavoriteRecord {
  id: string; // fixture id
  fixtureName: string;
  competition: string;
  date: string;
  probYes: number;
  addedAt: number;
}

export interface WatchlistRecord extends FavoriteRecord {
  note?: string;
}

export interface HistoryRecord {
  id: string; // unique prediction id
  fixtureId: string;
  fixtureName: string;
  competition: string;
  date: string;
  probYes: number;
  probNo: number;
  confidence: number;
  tier: string;
  createdAt: number;
}

interface BttsDB extends DBSchema {
  cache: {
    key: string;
    value: CacheRecord;
    indexes: { expiresAt: number };
  };
  favorites: {
    key: string;
    value: FavoriteRecord;
  };
  watchlist: {
    key: string;
    value: WatchlistRecord;
  };
  history: {
    key: string;
    value: HistoryRecord;
    indexes: { createdAt: number };
  };
  bets: {
    key: string;
    value: BetRecord;
    indexes: { createdAt: number };
  };
}

const DB_NAME = 'btts-analytics-pro';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<BttsDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BttsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BttsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          const cache = db.createObjectStore('cache', { keyPath: 'key' });
          cache.createIndex('expiresAt', 'expiresAt');
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('watchlist')) {
          db.createObjectStore('watchlist', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('history')) {
          const history = db.createObjectStore('history', { keyPath: 'id' });
          history.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('bets')) {
          const bets = db.createObjectStore('bets', { keyPath: 'id' });
          bets.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}
