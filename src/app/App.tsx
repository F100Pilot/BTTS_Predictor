import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Spinner } from '@/components/common/States';
import { PwaUpdatePrompt } from '@/components/common/PwaUpdatePrompt';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import { useCollections } from '@/store/collectionsStore';
import { useCalibration } from '@/store/calibrationStore';
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
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

export function App() {
  useThemeEffect();
  const refreshCollections = useCollections((s) => s.refresh);
  const refreshCalibration = useCalibration((s) => s.refresh);

  useEffect(() => {
    void refreshCollections();
    void refreshCalibration();
    void purgeExpired();
  }, [refreshCollections, refreshCalibration]);

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
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <PwaUpdatePrompt />
    </AppShell>
  );
}
