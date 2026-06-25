import { useEffect, useRef } from 'react';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { useCollections } from '@/store/collectionsStore';
import { notificationPermission, showNotification } from '@/services/notifications';
import { createLogger } from '@/services/logger';

const log = createLogger('liveNotifications');
const POLL_MS = 60_000;

/**
 * While the app is open and notifications are enabled, polls live scores and
 * fires local notifications on goals and on BTTS being achieved (watchlist).
 * Note: true background push (app fully closed) needs a push server — out of
 * scope for a static PWA, and unsupported on iOS without one.
 */
export function useLiveNotifications(): void {
  const data = useDataService();
  const notifyEnabled = useSettings((s) => s.notifyEnabled);
  const notifyGoals = useSettings((s) => s.notifyGoals);
  const notifyWatchlistBtts = useSettings((s) => s.notifyWatchlistBtts);
  const watchlist = useCollections((s) => s.watchlist);
  const prev = useRef<Map<string, { h: number; a: number }>>(new Map());

  useEffect(() => {
    if (!notifyEnabled || notificationPermission() !== 'granted') return;
    let cancelled = false;
    const watchIds = new Set(watchlist.map((w) => w.id));

    const tick = async (): Promise<void> => {
      try {
        const live = await data.getLiveMatches();
        if (cancelled) return;
        for (const m of live) {
          const before = prev.current.get(m.id);
          const label = `${m.home.name} ${m.homeGoals}-${m.awayGoals} ${m.away.name}`;
          if (before) {
            if (notifyGoals && m.homeGoals + m.awayGoals > before.h + before.a) {
              await showNotification('⚽ Golo!', {
                body: `${label} · ${m.competition.name}`,
                tag: `goal-${m.id}`,
              });
            }
            const bttsBefore = before.h > 0 && before.a > 0;
            const bttsNow = m.homeGoals > 0 && m.awayGoals > 0;
            if (notifyWatchlistBtts && !bttsBefore && bttsNow && watchIds.has(m.id)) {
              await showNotification('✅ BTTS concretizado', {
                body: `${label} · ${m.competition.name}`,
                tag: `btts-${m.id}`,
              });
            }
          }
          prev.current.set(m.id, { h: m.homeGoals, a: m.awayGoals });
        }
      } catch (err) {
        log.warn('live notification poll failed', err);
      }
    };

    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [data, notifyEnabled, notifyGoals, notifyWatchlistBtts, watchlist]);
}
