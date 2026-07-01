import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Bet, MarketPrediction } from '@/domain/types';
import type { MarketKey } from '@/core/markets/markets';

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
  /** Real BTTS outcome once known (for backtesting & auto-calibration). */
  actual?: 'yes' | 'no';
  /** Final scoreline once known, e.g. "2-1" (display only). */
  actualScore?: string;
  /** Data source that produced fixtureId — results must be fetched from the
   * same provider (ids are provider-specific). */
  providerId?: string;
  /** Flashscore match id (when the game was imported from Flashscore) — lets us
   * settle the result later straight from the Flashscore live/results feed. */
  flashMatchId?: string;
  /** Per-factor sub-scores at prediction time (for weight auto-tuning). */
  factorScores?: Record<string, number>;
  /** Poisson markets (Over/Under, 1X2) at prediction time — lets the history
   * track per-market accuracy, not just BTTS. */
  markets?: MarketPrediction;
  /** Which market lists this game was added to. A game added to BTTS stays out
   * of the O/U and 1X2 lists (and vice-versa). Absent ⇒ legacy, treated as
   * `['btts']`. */
  trackedMarkets?: MarketKey[];
}

/** A deletion marker so removals propagate across devices via sync. */
export interface TombstoneRecord {
  /** Composite key: `${kind}:${id}`. */
  key: string;
  id: string;
  kind: 'history' | 'bets';
  at: number; // epoch ms of deletion
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
  tombstones: {
    key: string;
    value: TombstoneRecord;
  };
}

const DB_NAME = 'btts-analytics-pro';
const DB_VERSION = 3;

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
        if (!db.objectStoreNames.contains('tombstones')) {
          db.createObjectStore('tombstones', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}
