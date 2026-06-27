import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Spinner } from '@/components/common/States';
import { PwaUpdatePrompt } from '@/components/common/PwaUpdatePrompt';
import { WhatsNewDialog } from '@/components/common/WhatsNewDialog';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import { useLiveNotifications } from '@/hooks/useLiveNotifications';
import { usePregameReminders } from '@/hooks/usePregameReminders';
import { useCollections } from '@/store/collectionsStore';
import { useCalibration } from '@/store/calibrationStore';
import { useSettings } from '@/store/settingsStore';
import { DEFAULT_PROVIDER_ID } from '@/data/providers/registry';
import { purgeMockData } from '@/data/cache/repositories';
import { purgeExpired } from '@/data/cache/cache';
import { syncNow, isSyncConfigured } from '@/services/syncService';

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const AnalysisPage = lazy(() =>
  import('@/pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage })),
);
const FavoritesPage = lazy(() =>
  import('@/pages/FavoritesPage').then((m) => ({ default: m.FavoritesPage })),
);
const WatchlistPage = lazy(() =>
  import('@/pages/WatchlistPage').then((m) => ({ default: m.WatchlistPage })),
);
const HistoryPage = lazy(() =>
  import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const MartingalePage = lazy(() =>
  import('@/pages/MartingalePage').then((m) => ({ default: m.MartingalePage })),
);
const LiveScorePage = lazy(() =>
  import('@/pages/LiveScorePage').then((m) => ({ default: m.LiveScorePage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const CalculatorPage = lazy(() =>
  import('@/pages/CalculatorPage').then((m) => ({ default: m.CalculatorPage })),
);

export function App() {
  useThemeEffect();
  useLiveNotifications();
  usePregameReminders();
  const refreshCollections = useCollections((s) => s.refresh);
  const refreshCalibration = useCalibration((s) => s.refresh);
  const providerId = useSettings((s) => s.providerId);
  const syncCode = useSettings((s) => s.syncCode);
  const corsProxy = useSettings((s) => s.corsProxy);

  useEffect(() => {
    (async () => {
      // With a real provider active, purge any demo-origin (mock) records that a
      // previous fallback/demo session may have stored, then load.
      if (providerId !== DEFAULT_PROVIDER_ID) {
        await purgeMockData().catch(() => 0);
      }
      await refreshCollections();
      await refreshCalibration();
      await purgeExpired();
    })();
  }, [refreshCollections, refreshCalibration, providerId]);

  // Cross-device sync: reconcile on mount, when the tab regains focus, and on a
  // gentle interval while visible. No-op until a sync code + proxy are set.
  useEffect(() => {
    if (!isSyncConfigured()) return;
    const run = (): void => {
      if (document.visibilityState === 'visible') void syncNow().catch(() => {});
    };
    run();
    const onVisible = (): void => run();
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(run, 45000);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(id);
    };
  }, [syncCode, corsProxy]);

  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<Spinner label="A carregar..." />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analysis/:fixtureId" element={<AnalysisPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/martingale" element={<MartingalePage />} />
            <Route path="/live" element={<LiveScorePage />} />
            <Route path="/calculator" element={<CalculatorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <PwaUpdatePrompt />
      <WhatsNewDialog />
    </AppShell>
  );
}
