import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Eye, Coins, AlertTriangle, RefreshCw, X } from 'lucide-react';
import type { AnalysisBundle, Fixture } from '@/domain/types';
import { calculateStake } from '@/core/martingale/martingale';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { useCollections } from '@/store/collectionsStore';
import { useFixtureCache } from '@/store/fixtureCacheStore';
import { useCalibration } from '@/store/calibrationStore';
import { buildAnalysis } from '@/services/analysisService';
import { cacheDelete } from '@/data/cache/cache';
import { upsertHistory } from '@/data/cache/repositories';
import { saveDayPrediction, predictionSignature } from '@/services/dayPredictions';
import { todayIso, formatTime } from '@/lib/format';
import { createLogger } from '@/services/logger';
import { Spinner, EmptyState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VerdictPill, ConfidenceMeter, TierBadge } from '@/components/common/PredictionWidgets';
import { FactorBreakdown } from '@/components/analysis/FactorBreakdown';
import { TeamStatsCard, HeadToHeadCard } from '@/components/analysis/StatsPanels';
import { MarketsCard, ValueCard } from '@/components/analysis/ExtraCards';
import { AnalysisCharts } from '@/components/analysis/AnalysisCharts';
import { TeamAvatar } from '@/components/common/TeamAvatar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const log = createLogger('AnalysisPage');

/** A red→amber→green gradient bar with a marker at `value` (0..1). */
function MeterBar({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums">
          {pct}%{sub ? <span className="font-normal text-muted-foreground"> · {sub}</span> : null}
        </span>
      </div>
      <div
        className="relative h-2 rounded-full"
        style={{
          background:
            'linear-gradient(90deg, hsl(0 72% 50%), hsl(38 92% 50%) 50%, hsl(152 72% 45%))',
        }}
      >
        <span
          className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-background"
          style={{ left: `calc(${pct}% - 3px)` }}
        />
      </div>
    </div>
  );
}

/** A compact label/value stat for the match-header strip. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Floating, translucent Martingale quick-calculator over the match. */
function MartingalePanel({
  defaultOdds,
  onOpenFull,
  onClose,
}: {
  defaultOdds?: number;
  onOpenFull: () => void;
  onClose: () => void;
}) {
  const [bank, setBank] = useState('100');
  const [target, setTarget] = useState('10');
  const [odds, setOdds] = useState(defaultOdds ? defaultOdds.toFixed(2) : '2.00');
  const o = Number(odds);
  const t = Number(target);
  const b = Number(bank);
  const stake = o > 1 && t > 0 ? calculateStake(0, t, o) : 0;
  const pctOfBank = b > 0 ? (stake / b) * 100 : 0;
  return (
    <Card className="glass border-primary/30 shadow-xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Coins className="h-4 w-4 text-primary" /> Martingale
          </div>
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MField label="Banca (€)">
            <Input inputMode="decimal" value={bank} onChange={(e) => setBank(e.target.value)} />
          </MField>
          <MField label="Lucro alvo (€)">
            <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </MField>
          <MField label="Odd">
            <Input inputMode="decimal" value={odds} onChange={(e) => setOdds(e.target.value)} />
          </MField>
          <MField label="Stake sugerida">
            <div className="flex h-10 items-center rounded-md border border-primary/40 bg-primary/10 px-3 font-bold tabular-nums text-primary">
              €{stake.toFixed(2)}
            </div>
          </MField>
        </div>
        <p className="text-xs text-muted-foreground">
          Para o passo 1 da série, ao teu lucro alvo e odd.
          {b > 0 && <> Representa {pctOfBank.toFixed(1)}% da banca.</>}
        </p>
        <Button className="w-full" onClick={onOpenFull}>
          Abrir Martingale completo
        </Button>
      </CardContent>
    </Card>
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
  const getCached = useFixtureCache((s) => s.get);
  const { toggleFavorite, toggleWatchlist, isFavorite, isWatched } = useCollections();

  const [bundle, setBundle] = useState<AnalysisBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showMart, setShowMart] = useState(false);

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
        kickoff: fixture.date,
      },
    });
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft /> Voltar
      </Button>

      <Card className="overflow-hidden">
        {/* Match header — crest avatars, VS, kickoff, competition */}
        <div className="border-b border-border bg-gradient-to-b from-primary/10 to-transparent p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {fixture.competition.country ? `${fixture.competition.country} · ` : ''}
              {fixture.competition.name}
            </p>
            <div className="flex">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Favorito"
                onClick={() => toggleFavorite(row)}
              >
                <Star
                  className={cn('h-4 w-4', isFavorite(fixture.id) && 'fill-warning text-warning')}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Watchlist"
                onClick={() => toggleWatchlist(row)}
              >
                <Eye className={cn('h-4 w-4', isWatched(fixture.id) && 'text-primary')} />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 flex-col items-center gap-2 text-center">
              <TeamAvatar name={fixture.home.name} size={56} />
              <span className="line-clamp-2 text-sm font-semibold">{fixture.home.name}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2">
              <span className="text-xs font-bold text-muted-foreground">VS</span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {formatTime(fixture.date)}
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-2 text-center">
              <TeamAvatar name={fixture.away.name} size={56} />
              <span className="line-clamp-2 text-sm font-semibold">{fixture.away.name}</span>
            </div>
          </div>
        </div>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <VerdictPill prediction={prediction} />
            <div className="flex items-center gap-4">
              <TierBadge tier={prediction.tier} />
              <ConfidenceMeter confidence={prediction.confidence} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MeterBar label="Previsão BTTS SIM" value={prediction.probYes} />
            <MeterBar
              label="H2H BTTS"
              value={bundle.h2h.bttsPct}
              sub={`${bundle.h2h.played} jogos`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-4">
            <Stat label="Golos casa" value={bundle.homeStats.last10.avgGoalsFor.toFixed(1)} />
            <Stat
              label="Sofridos casa"
              value={bundle.homeStats.last10.avgGoalsAgainst.toFixed(1)}
            />
            <Stat label="Golos fora" value={bundle.awayStats.last10.avgGoalsFor.toFixed(1)} />
            <Stat
              label="Sofridos fora"
              value={bundle.awayStats.last10.avgGoalsAgainst.toFixed(1)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={showMart ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowMart((v) => !v)}
            >
              <Coins className="h-4 w-4" /> Martingale
            </Button>
            <Button variant="outline" size="sm" onClick={handleReanalyze}>
              <RefreshCw className="h-4 w-4" /> Reanalisar
            </Button>
          </div>
          {showMart && (
            <MartingalePanel
              defaultOdds={prediction.probYes >= 0.5 ? fixture.odds?.bttsYes : fixture.odds?.bttsNo}
              onOpenFull={goToMartingale}
              onClose={() => setShowMart(false)}
            />
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
    </div>
  );
}
