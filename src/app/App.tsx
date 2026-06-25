import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Spinner } from '@/components/common/States';
import { PwaUpdatePrompt } from '@/components/common/PwaUpdatePrompt';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import { useLiveNotifications } from '@/hooks/useLiveNotifications';
import { usePregameReminders } from '@/hooks/usePregameReminders';
import { useCollections } from '@/store/collectionsStore';
import { useCalibration } from '@/store/calibrationStore';
import { useSettings } from '@/store/settingsStore';
import { DEFAULT_PROVIDER_ID } from '@/data/providers/registry';
import { purgeMockData } from '@/data/cache/repositories';
import { purgeExpired } from '@/data/cache/cache';

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

export function App() {
  useThemeEffect();
  useLiveNotifications();
  usePregameReminders();
  const refreshCollections = useCollections((s) => s.refresh);
  const refreshCalibration = useCalibration((s) => s.refresh);
  const providerId = useSettings((s) => s.providerId);

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
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <PwaUpdatePrompt />
    </AppShell>
  );
}
