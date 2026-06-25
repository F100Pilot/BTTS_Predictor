import { useEffect, useRef } from 'react';
import { parseISO, differenceInMinutes } from 'date-fns';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { useCollections } from '@/store/collectionsStore';
import { notificationPermission, showNotification } from '@/services/notifications';
import { todayIso, formatTime } from '@/lib/format';
import { createLogger } from '@/services/logger';

const log = createLogger('pregameReminders');
const CHECK_MS = 5 * 60 * 1000; // re-check every 5 min

/**
 * While the app is open, reminds the user shortly before kickoff of games in
 * their Watchlist or Favorites (within `notifyPregameMinutes`).
 */
export function usePregameReminders(): void {
  const data = useDataService();
  const notifyEnabled = useSettings((s) => s.notifyEnabled);
  const notifyPregame = useSettings((s) => s.notifyPregame);
  const minutes = useSettings((s) => s.notifyPregameMinutes);
  const watchlist = useCollections((s) => s.watchlist);
  const favorites = useCollections((s) => s.favorites);
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notifyEnabled || !notifyPregame || notificationPermission() !== 'granted') return;
    let cancelled = false;
    const trackedIds = new Set([...watchlist.map((w) => w.id), ...favorites.map((f) => f.id)]);
    if (trackedIds.size === 0) return;

    const tick = async (): Promise<void> => {
      try {
        const fixtures = await data.getFixturesByDate(todayIso());
        if (cancelled) return;
        const now = new Date();
        for (const f of fixtures) {
          if (!trackedIds.has(f.id) || notified.current.has(f.id)) continue;
          const mins = differenceInMinutes(parseISO(f.date), now);
          if (mins >= 0 && mins <= minutes) {
            notified.current.add(f.id);
            await showNotification('⏰ Jogo a começar em breve', {
              body: `${f.home.name} vs ${f.away.name} · ${formatTime(f.date)} (${mins} min)`,
              tag: `pregame-${f.id}`,
            });
          }
        }
      } catch (err) {
        log.warn('pregame check failed', err);
      }
    };

    void tick();
    const id = setInterval(() => void tick(), CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [data, notifyEnabled, notifyPregame, minutes, watchlist, favorites]);
}
