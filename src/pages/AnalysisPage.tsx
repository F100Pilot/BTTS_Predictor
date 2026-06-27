import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Eye, Coins, AlertTriangle, RefreshCw } from 'lucide-react';
import type { AnalysisBundle, Fixture } from '@/domain/types';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { useCollections } from '@/store/collectionsStore';
import { useFixtureCache, dateFromMockId } from '@/store/fixtureCacheStore';
import { useCalibration } from '@/store/calibrationStore';
import { buildAnalysis } from '@/services/analysisService';
import { cacheDelete } from '@/data/cache/cache';
import { upsertHistory } from '@/data/cache/repositories';
import { saveDayPrediction, predictionSignature } from '@/services/dayPredictions';
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
  const providerId = useSettings((s) => s.providerId);
  const platt = useCalibration((s) => s.platt);
  const calibrationReady = useCalibration((s) => s.ready);
  const recalibration = autoCalibrate && calibrationReady ? platt : undefined;
  const getCached = useFixtureCache((s) => s.get);
  const { toggleFavorite, toggleWatchlist, isFavorite, isWatched } = useCollections();

  const [bundle, setBundle] = useState<AnalysisBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
    setLoadError(null);
    (async () => {
      try {
        const fixture = await resolveFixture();
        if (!fixture) {
          if (!cancelled) {
            setBundle(null);
            setLoadError(null);
          }
          return;
        }
        // Auto-fill bookmaker odds when the provider supports them and the
        // fixture doesn't already carry them (powers value/calibration cards).
        let enriched = fixture;
        if (!fixture.odds?.bttsYes && !fixture.odds?.bttsNo) {
          const odds = await data.getOdds(fixture.id).catch(() => null);
          if (odds && (odds.bttsYes || odds.bttsNo)) {
            enriched = { ...fixture, odds: { ...fixture.odds, ...odds } };
          }
        }
        const result = await buildAnalysis(data, enriched, {
          weights,
          oddsCalibration,
          recalibration,
        });
        if (cancelled) return;
        setBundle(result);
        // Cache into the per-day store so an individually-analysed game (e.g. in
        // API-Football manual mode) is remembered and not re-analysed — including
        // insufficient-data games, which the dashboard then hides (so they
        // "disappear" and never cost another request).
        if (result.prediction) {
          const day = fixture.date.slice(0, 10);
          const sig = predictionSignature(weights, oddsCalibration, recalibration);
          void saveDayPrediction(day, sig, fixture.id, result.prediction);
        }
        // Record the prediction in history (one record per fixture, best-effort).
        // Skip insufficient-data games — a ~50/50 placeholder would pollute the
        // calibration/performance stats. upsertHistory freezes the prediction
        // once a real result has been recorded.
        if (!result.prediction.insufficientData) {
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
            providerId,
            factorScores: Object.fromEntries(
              result.prediction.factors.map((f) => [f.key, f.score]),
            ),
          }).catch((err) => log.warn('history save failed', err));
        }
      } catch (err) {
        log.error('analysis failed', err);
        if (!cancelled) {
          setBundle(null);
          const status = (err as { status?: number })?.status;
          setLoadError(
            status === 429
              ? 'Limite de pedidos atingido. Aguarda ~1 minuto e tenta de novo.'
              : 'Erro ao carregar a análise. Verifica a ligação e tenta de novo.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveFixture, data, weights, oddsCalibration, recalibration, providerId, refreshKey]);

  if (loading) return <Spinner label="A analisar o jogo..." />;
  if (!bundle)
    return (
      <EmptyState
        title={loadError ? 'Erro ao carregar' : 'Jogo não encontrado'}
        description={
          loadError ??
          'Este jogo não existe na fonte de dados atual. Volte ao painel e tente novamente.'
        }
        action={
          <div className="flex gap-2">
            {loadError && (
              <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
                <RefreshCw /> Tentar de novo
              </Button>
            )}
            <Button onClick={() => navigate('/')}>
              <ArrowLeft /> Voltar
            </Button>
          </div>
        }
      />
    );

  const { fixture, prediction } = bundle;
  const row = { fixture, prediction };
  const tier = tierMeta(prediction.tier);

  const handleReanalyze = (): void => {
    // Drop cached team history (limit 15, see analysisService) + odds so the next
    // run re-fetches fresh data from the active provider.
    void cacheDelete(`${providerId}:team:${fixture.home.id}:15`);
    void cacheDelete(`${providerId}:team:${fixture.away.id}:15`);
    void cacheDelete(`${providerId}:odds:${fixture.id}`);
    setRefreshKey((k) => k + 1);
  };

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
              <Button variant="outline" size="sm" onClick={handleReanalyze}>
                <RefreshCw className="h-4 w-4" /> Reanalisar
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
          {prediction.insufficientData && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                <span className="font-medium">Dados insuficientes.</span> A fonte ativa devolveu
                pouco histórico destas equipas (mín. 3 jogos por equipa):{' '}
                <span className="font-medium">
                  {fixture.home.name} {bundle.homeStats.last10.played} jogo(s)
                </span>{' '}
                ·{' '}
                <span className="font-medium">
                  {fixture.away.name} {bundle.awayStats.last10.played} jogo(s)
                </span>
                . A previsão fica indicativa (~50/50) e não deve ser usada para apostar. Seleções
                (Mundial/Euro) costumam ter pouco histórico — na API-Football a análise tenta
                complementar com estatísticas da época, mas se não existirem, o resultado mantém-se
                inconclusivo.
              </span>
            </div>
          )}
          {!prediction.insufficientData &&
            (bundle.homeStats.seasonStats ?? bundle.awayStats.seasonStats) && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
                <span>
                  Histórico recente insuficiente — previsão complementada com estatísticas da época
                  atual (API-Football).
                </span>
              </div>
            )}
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
