import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Eye, Coins } from 'lucide-react';
import type { AnalysisBundle, Fixture } from '@/domain/types';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { useCollections } from '@/store/collectionsStore';
import { useFixtureCache, dateFromMockId } from '@/store/fixtureCacheStore';
import { useCalibration } from '@/store/calibrationStore';
import { buildAnalysis } from '@/services/analysisService';
import { upsertHistory } from '@/data/cache/repositories';
import { todayIso, formatDateTime } from '@/lib/format';
import { tierMeta } from '@/core/classification/classification';
import { createLogger } from '@/services/logger';
import { Spinner, EmptyState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  VerdictPill,
  ProbabilityBar,
  ConfidenceMeter,
  TierBadge,
} from '@/components/common/PredictionWidgets';
import { FactorBreakdown } from '@/components/analysis/FactorBreakdown';
import { TeamStatsCard, HeadToHeadCard } from '@/components/analysis/StatsPanels';
import { MarketsCard, ValueCard } from '@/components/analysis/ExtraCards';
import { AnalysisCharts } from '@/components/analysis/AnalysisCharts';
import { cn } from '@/lib/utils';

const log = createLogger('AnalysisPage');

export function AnalysisPage() {
  const { fixtureId = '' } = useParams();
  const id = decodeURIComponent(fixtureId);
  const navigate = useNavigate();
  const data = useDataService();
  const weights = useSettings((s) => s.weights);
  const oddsCalibration = useSettings((s) => s.oddsCalibration);
  const autoCalibrate = useSettings((s) => s.autoCalibrate);
  const platt = useCalibration((s) => s.platt);
  const calibrationReady = useCalibration((s) => s.ready);
  const recalibration = autoCalibrate && calibrationReady ? platt : undefined;
  const getCached = useFixtureCache((s) => s.get);
  const { toggleFavorite, toggleWatchlist, isFavorite, isWatched } = useCollections();

  const [bundle, setBundle] = useState<AnalysisBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveFixture = useCallback(async (): Promise<Fixture | undefined> => {
    const cached = getCached(id);
    if (cached) return cached;
    const dates = [dateFromMockId(id), todayIso()].filter((d): d is string => Boolean(d));
    for (const date of dates) {
      const fixtures = await data.getFixturesByDate(date);
      const found = fixtures.find((f) => f.id === id);
      if (found) return found;
    }
    return undefined;
  }, [data, getCached, id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const fixture = await resolveFixture();
        if (!fixture) {
          if (!cancelled) setBundle(null);
          return;
        }
        const result = await buildAnalysis(data, fixture, {
          weights,
          oddsCalibration,
          recalibration,
        });
        if (cancelled) return;
        setBundle(result);
        // Record the prediction in history (one record per fixture, best-effort).
        upsertHistory({
          id: fixture.id,
          fixtureId: fixture.id,
          fixtureName: `${fixture.home.name} vs ${fixture.away.name}`,
          competition: fixture.competition.name,
          date: fixture.date,
          probYes: result.prediction.probYes,
          probNo: result.prediction.probNo,
          confidence: result.prediction.confidence,
          tier: result.prediction.tier,
          createdAt: Date.now(),
        }).catch((err) => log.warn('history save failed', err));
      } catch (err) {
        log.error('analysis failed', err);
        if (!cancelled) setBundle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveFixture, data, weights, oddsCalibration, recalibration]);

  if (loading) return <Spinner label="A analisar o jogo..." />;
  if (!bundle)
    return (
      <EmptyState
        title="Jogo não encontrado"
        description="Não foi possível carregar este jogo. Volte ao painel e tente novamente."
        action={
          <Button onClick={() => navigate('/')}>
            <ArrowLeft /> Voltar
          </Button>
        }
      />
    );

  const { fixture, prediction } = bundle;
  const row = { fixture, prediction };
  const tier = tierMeta(prediction.tier);

  const goToMartingale = (): void => {
    const selection = prediction.probYes >= 0.5 ? 'SIM' : 'NÃO';
    const odds = selection === 'SIM' ? fixture.odds?.bttsYes : fixture.odds?.bttsNo;
    navigate('/martingale', {
      state: {
        matchLabel: `${fixture.home.name} vs ${fixture.away.name}`,
        selection,
        odds,
        fixtureId: fixture.id,
      },
    });
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft /> Voltar
      </Button>

      <Card
        className={cn(
          'border-l-4',
          tier.tier === 'very-strong' ? 'border-l-success' : 'border-l-primary',
        )}
      >
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {fixture.competition.name} · {formatDateTime(fixture.date)}
              </p>
              <CardTitle className="mt-1 text-2xl">
                {fixture.home.name} <span className="text-muted-foreground">vs</span>{' '}
                {fixture.away.name}
              </CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={isFavorite(fixture.id) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFavorite(row)}
              >
                <Star className="h-4 w-4" /> Favorito
              </Button>
              <Button
                variant={isWatched(fixture.id) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleWatchlist(row)}
              >
                <Eye className="h-4 w-4" /> Watchlist
              </Button>
              <Button variant="outline" size="sm" onClick={goToMartingale}>
                <Coins className="h-4 w-4" /> Martingale
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <VerdictPill prediction={prediction} />
            <div className="flex items-center gap-4">
              <TierBadge tier={prediction.tier} />
              <ConfidenceMeter confidence={prediction.confidence} />
            </div>
          </div>
          <ProbabilityBar probYes={prediction.probYes} />
        </CardContent>
      </Card>

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
          <TabsTrigger value="model">Modelo</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <TeamStatsCard stats={bundle.homeStats} title={`${fixture.home.name} (Casa)`} />
            <TeamStatsCard stats={bundle.awayStats} title={`${fixture.away.name} (Fora)`} />
          </div>
          <HeadToHeadCard h2h={bundle.h2h} />
          <ValueCard prediction={prediction} fixture={fixture} />
          <MarketsCard markets={bundle.markets} fixture={fixture} />
        </TabsContent>

        <TabsContent value="charts">
          <AnalysisCharts bundle={bundle} />
        </TabsContent>

        <TabsContent value="model">
          <FactorBreakdown prediction={prediction} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
