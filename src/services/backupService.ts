import { getDb } from '@/data/cache/db';
import { createLogger } from '@/services/logger';

const log = createLogger('backup');

const LS_KEYS = ['btts:settings', 'btts:martingale'];
const DB_STORES = ['favorites', 'watchlist', 'history', 'bets'] as const;

export interface ProfileBackup {
  app: 'btts-analytics-pro';
  version: 1;
  exportedAt: string;
  localStorage: Record<string, string>;
  db: Record<string, unknown[]>;
}

/** Collect settings (LocalStorage) + data (IndexedDB) into a JSON file. */
export async function exportProfile(): Promise<void> {
  const ls: Record<string, string> = {};
  for (const key of LS_KEYS) {
    const v = localStorage.getItem(key);
    if (v != null) ls[key] = v;
  }

  const db = await getDb();
  const dbData: Record<string, unknown[]> = {};
  for (const store of DB_STORES) {
    dbData[store] = await db.getAll(store);
  }

  const backup: ProfileBackup = {
    app: 'btts-analytics-pro',
    version: 1,
    exportedAt: new Date().toISOString(),
    localStorage: ls,
    db: dbData,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `btts-perfil-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Restore a profile backup. Replaces current settings + data. */
export async function importProfile(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as ProfileBackup;
  if (data.app !== 'btts-analytics-pro') {
    throw new Error('Ficheiro de backup inválido.');
  }

  for (const [key, value] of Object.entries(data.localStorage ?? {})) {
    if (LS_KEYS.includes(key)) localStorage.setItem(key, value);
  }

  const db = await getDb();
  for (const store of DB_STORES) {
    const rows = data.db?.[store];
    if (!Array.isArray(rows)) continue;
    const tx = db.transaction(store, 'readwrite');
    await tx.store.clear();
    for (const row of rows) await tx.store.put(row as never);
    await tx.done;
  }
  log.info('profile imported');
}
