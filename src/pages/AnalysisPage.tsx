import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, AlertTriangle, RefreshCw } from 'lucide-react';
import type { AnalysisBundle, Fixture, MarketPrediction } from '@/domain/types';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { useMarket } from '@/store/marketStore';
import { useFixtureCache } from '@/store/fixtureCacheStore';
import { useCalibration } from '@/store/calibrationStore';
import { buildAnalysis } from '@/services/analysisService';
import { cacheDelete } from '@/data/cache/cache';
import { upsertHistory } from '@/data/cache/repositories';
import { saveDayPrediction, predictionSignature } from '@/services/dayPredictions';
import { todayIso, formatDateTime } from '@/lib/format';
import { toPercent } from '@/lib/math';
import { tierMeta, tierForProbability } from '@/core/classification/classification';
import { marketPick, marketLabel, type MarketKey } from '@/core/markets/markets';
import { MarketSelector } from '@/components/common/MarketSelector';
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
import { MartingaleDialog } from '@/components/martingale/MartingaleDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { cn } from '@/lib/utils';

const log = createLogger('AnalysisPage');

/** Text colour for a market pick tone (green pos / red neg / primary neutral). */
function pickToneClass(tone: 'pos' | 'neg' | 'neutral'): string {
  return tone === 'pos' ? 'text-success' : tone === 'neg' ? 'text-destructive' : 'text-primary';
}

/** A segmented probability bar for the non-BTTS markets (Over/Under, 1X2). */
function MarketBar({ market, markets }: { market: MarketKey; markets: MarketPrediction }) {
  const pct = (v: number): number => Math.round(v * 100);
  const segs =
    market === 'ou25'
      ? [
          {
            key: 'over',
            label: `Over 2.5 ${pct(markets.over25)}%`,
            v: markets.over25,
            cls: 'bg-primary',
          },
          {
            key: 'under',
            label: `Under 2.5 ${pct(markets.under25)}%`,
            v: markets.under25,
            cls: 'bg-destructive/70',
          },
        ]
      : [
          {
            key: 'home',
            label: `Casa ${pct(markets.homeWin)}%`,
            v: markets.homeWin,
            cls: 'bg-primary',
          },
          {
            key: 'draw',
            label: `X ${pct(markets.draw)}%`,
            v: markets.draw,
            cls: 'bg-muted-foreground',
          },
          {
            key: 'away',
            label: `Fora ${pct(markets.awayWin)}%`,
            v: markets.awayWin,
            cls: 'bg-success',
          },
        ];
  const total = segs.reduce((s, x) => s + x.v, 0) || 1;
  return (
    <div className="w-full">
      <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        {segs.map((s) => (
          <span key={s.key}>{s.label}</span>
        ))}
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {segs.map((s) => (
          <div
            key={s.key}
            className={cn('h-full', s.cls)}
            style={{ width: `${(s.v / total) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

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
  const autoCalibrateOu25 = useSettings((s) => s.autoCalibrateOu25);
  const plattOu25 = useCalibration((s) => s.plattOu25);
  const ou25Ready = useCalibration((s) => s.ou25Ready);
  const ou25Recalibration = autoCalibrateOu25 && ou25Ready ? plattOu25 : undefined;
  const getCached = useFixtureCache((s) => s.get);
  const market = useMarket((s) => s.market);
  const setMarket = useMarket((s) => s.setMarket);

  const [bundle, setBundle] = useState<AnalysisBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [martOpen, setMartOpen] = useState(false);
  const [confirmReanalyze, setConfirmReanalyze] = useState(false);

  const resolveFixture = useCallback(async (): Promise<Fixture | undefined> => {
    const cached = getCached(id);
    if (cached) return cached;
    const fixtures = await data.getFixturesByDate(todayIso());
    return fixtures.find((f) => f.id === id);
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
          ou25Recalibration,
        });
        if (cancelled) return;
        setBundle(result);
        // Cache into the per-day store so an individually-analysed game (e.g. in
        // API-Football manual mode) is remembered and not re-analysed — including
        // insufficient-data games, which the dashboard then hides (so they
        // "disappear" and never cost another request).
        if (result.prediction) {
          const day = fixture.date.slice(0, 10);
          const sig = predictionSignature(
            weights,
            oddsCalibration,
            recalibration,
            ou25Recalibration,
          );
          void saveDayPrediction(day, sig, fixture.id, result.prediction, result.markets);
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
            markets: result.markets,
            trackedMarkets: ['btts'],
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
  }, [
    resolveFixture,
    data,
    weights,
    oddsCalibration,
    recalibration,
    ou25Recalibration,
    providerId,
    refreshKey,
  ]);

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
  const tier = tierMeta(prediction.tier);
  // The dominant pick for the currently-selected market (so the headline follows
  // the market chosen on Jogos/Histórico, instead of always showing BTTS).
  const pick = marketPick(market, prediction, bundle.markets);

  const handleReanalyze = (): void => {
    // Drop cached team history (limit 15, see analysisService) + odds so the next
    // run re-fetches fresh data from the active provider.
    void cacheDelete(`${providerId}:team:${fixture.home.id}:15`);
    void cacheDelete(`${providerId}:team:${fixture.away.id}:15`);
    void cacheDelete(`${providerId}:odds:${fixture.id}`);
    setRefreshKey((k) => k + 1);
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
              <Button variant="outline" size="sm" onClick={() => setMartOpen(true)}>
                <Coins className="h-4 w-4" /> Martingale
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmReanalyze(true)}>
                <RefreshCw className="h-4 w-4" /> Reanalisar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector value={market} onChange={setMarket} className="flex-wrap" />
          {market === 'btts' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <VerdictPill prediction={prediction} />
                <div className="flex items-center gap-4">
                  <TierBadge tier={prediction.tier} />
                  <ConfidenceMeter confidence={prediction.confidence} />
                </div>
              </div>
              <ProbabilityBar probYes={prediction.probYes} />
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">
                    {pick ? pick.side : marketLabel(market)}
                  </span>
                  {pick && (
                    <span className={cn('text-lg font-semibold', pickToneClass(pick.tone))}>
                      {toPercent(pick.probability)}
                    </span>
                  )}
                </div>
                {pick && <TierBadge tier={tierForProbability(pick.probability)} />}
              </div>
              <MarketBar market={market} markets={bundle.markets} />
              <p className="text-xs text-muted-foreground">
                {marketLabel(market)} · modelo de Poisson. Vê os detalhes no cartão “Outros
                mercados” abaixo.
              </p>
            </>
          )}
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

      <MartingaleDialog
        open={martOpen}
        onOpenChange={setMartOpen}
        game={{
          matchLabel: `${fixture.home.name} vs ${fixture.away.name}`,
          fixtureId: fixture.id,
          kickoff: fixture.date,
          oddsYes: fixture.odds?.bttsYes,
          oddsNo: fixture.odds?.bttsNo,
          defaultSelection: prediction.probYes >= 0.5 ? 'SIM' : 'NÃO',
        }}
      />

      <ConfirmDialog
        open={confirmReanalyze}
        onOpenChange={setConfirmReanalyze}
        title="Reanalisar jogo?"
        description="Vai descartar a análise guardada e procurar dados frescos na fonte ativa, consumindo novos pedidos à API. Queres continuar?"
        confirmLabel="Reanalisar"
        onConfirm={handleReanalyze}
      />
    </div>
  );
}
