/**
 * Cross-device sync for history & bets via the user's Cloudflare Worker + KV.
 *
 * There is no central account: data is namespaced by a user-chosen "sync code"
 * (a shared secret). Put the same code on every device and they converge. The
 * worker base is derived from the configured CORS proxy (it's the same worker).
 *
 * Strategy: a full reconcile — pull the remote blob, merge it with local by id,
 * write the merged set back to IndexedDB, then push the merged set up. Merges
 * are union-by-id with a "more settled wins" rule so grading/result changes on
 * one device propagate without clobbering fresh additions on another.
 */
import type { BetRecord, HistoryRecord } from '@/data/cache/db';
import { addHistory, listHistory, listBets, putBet } from '@/data/cache/repositories';
import { useSettings } from '@/store/settingsStore';
import { createLogger } from './logger';

const log = createLogger('sync');

const MIN_CODE_LEN = 6;

/** Worker origin derived from the CORS proxy setting (both point at the worker). */
function syncBase(): string | null {
  const p = (useSettings.getState().corsProxy || '').trim();
  if (!p) return null;
  try {
    return new URL(p.replace('{url}', '')).origin;
  } catch {
    return null;
  }
}

function code(): string {
  return (useSettings.getState().syncCode || '').trim();
}

/** True when a sync code and a worker base are both configured. */
export function isSyncConfigured(): boolean {
  return code().length >= MIN_CODE_LEN && syncBase() !== null;
}

function endpoint(base: string, kind: 'history' | 'bets'): string {
  return `${base}/sync?code=${encodeURIComponent(code())}&kind=${kind}`;
}

async function pull<T>(kind: 'history' | 'bets'): Promise<T[] | null> {
  const base = syncBase();
  if (!base || !isSyncConfigured()) return null;
  const res = await fetch(endpoint(base, kind));
  if (!res.ok) throw new Error(`sync pull ${kind} ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as T[]) : [];
}

async function push<T>(kind: 'history' | 'bets', data: T[]): Promise<void> {
  const base = syncBase();
  if (!base || !isSyncConfigured()) return;
  const res = await fetch(endpoint(base, kind), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`sync push ${kind} ${res.status}`);
}

/** A settled history record (has a real outcome) wins over an unsettled one. */
function mergeHistory(local: HistoryRecord[], remote: HistoryRecord[]): HistoryRecord[] {
  const byId = new Map<string, HistoryRecord>();
  for (const r of local) byId.set(r.id, r);
  for (const r of remote) {
    const cur = byId.get(r.id);
    if (!cur) byId.set(r.id, r);
    else if (r.actual && !cur.actual) byId.set(r.id, r);
    // else keep local (already settled, or neither settled)
  }
  return [...byId.values()];
}

/** A more-recently-settled bet wins; otherwise union by id. */
function mergeBets(local: BetRecord[], remote: BetRecord[]): BetRecord[] {
  const byId = new Map<string, BetRecord>();
  for (const b of local) byId.set(b.id, b);
  for (const b of remote) {
    const cur = byId.get(b.id);
    if (!cur) byId.set(b.id, b);
    else if ((b.settledAt ?? 0) > (cur.settledAt ?? 0)) byId.set(b.id, b);
  }
  return [...byId.values()];
}

// Guard so the writes performed by a reconcile don't re-trigger scheduleSync.
let applying = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Full reconcile: pull → merge → write local → push. Safe to call often; a
 * no-op when sync isn't configured.
 */
export async function syncNow(): Promise<{ ok: boolean; reason?: string }> {
  if (!isSyncConfigured()) return { ok: false, reason: 'not-configured' };
  applying = true;
  try {
    const [localH, remoteH] = await Promise.all([
      listHistory(100000),
      pull<HistoryRecord>('history'),
    ]);
    const mergedH = mergeHistory(localH, remoteH ?? []);
    for (const r of mergedH) await addHistory(r);
    await push('history', mergedH);

    const [localB, remoteB] = await Promise.all([listBets(), pull<BetRecord>('bets')]);
    const mergedB = mergeBets(localB, remoteB ?? []);
    for (const b of mergedB) await putBet(b);
    await push('bets', mergedB);

    // Refresh the in-memory bets store so the change is visible immediately.
    // Dynamic import keeps the module graph acyclic.
    try {
      const { useMartingale } = await import('@/store/martingaleStore');
      await useMartingale.getState().refresh();
    } catch {
      /* store not ready — ignore */
    }
    return { ok: true };
  } finally {
    applying = false;
  }
}

/** Debounced reconcile, called from data writes. No-op while a sync is running. */
export function scheduleSync(): void {
  if (applying || !isSyncConfigured()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void syncNow().catch((err) => log.warn('scheduled sync failed', err));
  }, 1500);
}
