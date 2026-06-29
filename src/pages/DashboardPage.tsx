import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { addDays, format } from 'date-fns';
import {
  CalendarX,
  Download,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  SlidersHorizontal,
  Trophy,
  Clock,
  Settings,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DashboardRow, Fixture } from '@/domain/types';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { getProvider } from '@/data/providers/registry';
import { buildDashboardRow, sortDashboardRowsByMarket } from '@/services/analysisService';
import { useMarket } from '@/store/marketStore';
import { MarketSelector } from '@/components/common/MarketSelector';
import { marketLabel } from '@/core/markets/markets';
import { isMinorCompetition, isMajorCompetition } from '@/core/classification/competitions';
import {
  loadDayPredictions,
  saveDayPrediction,
  clearDayPredictions,
  predictionSignature,
} from '@/services/dayPredictions';
import { todayIso, formatDate } from '@/lib/format';
import { createLogger } from '@/services/logger';
import {
  applyFilters,
  sortByFavourite,
  uniqueCompetitions,
  uniqueCountries,
} from '@/components/dashboard/filters';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { GamesTable } from '@/components/dashboard/GamesTable';
import { IconAction } from '@/components/common/IconAction';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFixtureCache } from '@/store/fixtureCacheStore';
import { useDashboardFilters } from '@/store/dashboardFiltersStore';
import { useCalibration } from '@/store/calibrationStore';
import { Spinner, EmptyState } from '@/components/common/States';
import { QuotaBadge } from '@/components/common/QuotaBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { exportCsv, exportPdf, exportXlsx } from '@/services/exportService';

const log = createLogger('DashboardPage');

/**
 * Order fixtures by analysis priority: upcoming games (not yet kicked off) first,
 * soonest kickoff first; already-started/finished games go last. This way a day
 * with hundreds of fixtures analyses the *next games to be played* first instead
 * of burning the API budget on matches that are already over.
 */
function orderByKickoff(fixtures: Fixture[]): Fixture[] {
  const now = Date.now();
  return [...fixtures].sort((a, b) => {
    const ta = Date.parse(a.date);
    const tb = Date.parse(b.date);
    const aPast = ta < now;
    const bPast = tb < now;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return ta - tb;
  });
}

export function DashboardPage() {
  const data = useDataService();
  const weights = useSettings((s) => s.weights);
  const oddsCalibration = useSettings((s) => s.oddsCalibration);
  const autoCalibrate = useSettings((s) => s.autoCalibrate);
  const platt = useCalibration((s) => s.platt);
  const calibrationReady = useCalibration((s) => s.ready);
  // Memoise by the actual Platt coefficients (not object identity) so a routine
  // calibration refresh elsewhere doesn't re-run the fetch effect and wipe rows.
  const recalibration = useMemo(
    () => (autoCalibrate && calibrationReady ? platt : undefined),
    // Intentionally keyed by coefficients, not the `platt` object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autoCalibrate, calibrationReady, platt?.a, platt?.b],
  );
  const hideAmateur = useSettings((s) => s.hideAmateur);
  const majorOnly = useSettings((s) => s.majorOnly);
  const setMajorOnly = useSettings((s) => s.setMajorOnly);
  const hideStarted = useSettings((s) => s.hideStarted);
  const setHideStarted = useSettings((s) => s.setHideStarted);
  const batchSize = useSettings((s) => s.analysisBatchSize);
  const providerId = useSettings((s) => s.providerId);
  const cacheFixtures = useFixtureCache((s) => s.put);
  const market = useMarket((s) => s.market);
  const setMarket = useMarket((s) => s.setMarket);
  const { filters, setFilters } = useDashboardFilters();
  // `fixtures` is the kickoff-ordered list; it drives analysis priority (not display).
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmReanalyze, setConfirmReanalyze] = useState(false);
  // How many fixtures (in kickoff order) we are allowed to analyse. 0 batch size
  // means "analyse everything" (Infinity).
  const [batchLimit, setBatchLimit] = useState<number>(() => batchSize || Infinity);
  // Auto-jump to the next day with games only once, on the initial load.
  const autoJumpDone = useRef(false);
  // Fixture ids already analysed (from cache or this session) — skip re-analysing.
  const analyzedRef = useRef<Set<string>>(new Set());
  const sigRef = useRef('');

  // Effect A — fetch fixtures + seed rows from cache. Does NOT analyse, so
  // extending the batch later never re-fetches or flashes the spinner.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    setFixtures([]);
    setLoadError(null);
    analyzedRef.current = new Set();
    const sig = predictionSignature(weights, oddsCalibration, recalibration);
    sigRef.current = sig;
    (async () => {
      const allFixtures = await data.getFixturesByDate(filters.date);
      if (cancelled) return;
      // Narrow the fixtures BEFORE analysis so we don't burn the API budget on
      // hundreds of matches that never finish analysing. "Major only" is the
      // strongest filter (top leagues + world/continental cups); otherwise we
      // at least drop amateur/youth/friendly games.
      const byCompetition = majorOnly
        ? allFixtures.filter((f) => isMajorCompetition(f.competition.name, f.competition.country))
        : hideAmateur
          ? allFixtures.filter((f) => !isMinorCompetition(f.competition.name))
          : allFixtures;
      // Drop games that have already kicked off — predicting a match in progress
      // or already finished is pointless and just wastes the API budget.
      const now = Date.now();
      const dayFixtures = hideStarted
        ? byCompetition.filter((f) => Date.parse(f.date) > now)
        : byCompetition;

      // On first load, if the selected day has no games, jump to the next day
      // within the next 21 days that does (keeps the user from landing on empty).
      if (dayFixtures.length === 0 && !autoJumpDone.current) {
        autoJumpDone.current = true;
        const from = filters.date;
        const to = format(addDays(new Date(`${from}T12:00:00Z`), 21), 'yyyy-MM-dd');
        const dates = (await data.getFixtureDatesInRange(from, to)).filter((d) => d >= from).sort();
        if (cancelled) return;
        const next = dates[0];
        if (next && next !== filters.date) {
          setFilters((f) => ({ ...f, date: next })); // re-runs this effect for the new date
          return;
        }
      }
      autoJumpDone.current = true;

      const ordered = orderByKickoff(dayFixtures);
      cacheFixtures(ordered);
      // Reuse any predictions already analysed for this day+settings; the rest
      // fill in progressively. Saved games never get re-analysed (saves API).
      const saved = await loadDayPredictions(filters.date, sig);
      if (cancelled) return;
      analyzedRef.current = new Set(Object.keys(saved));
      setFixtures(ordered);
      setRows(
        ordered.map((fixture) => ({
          fixture,
          prediction: saved[fixture.id]?.prediction,
          markets: saved[fixture.id]?.markets,
        })),
      );
      setBatchLimit(batchSize || Infinity); // reset the window on a fresh load
      setLoading(false);
    })().catch((err: unknown) => {
      log.error('failed to load dashboard', err);
      if (cancelled) return;
      const status = (err as { status?: number })?.status;
      setLoadError(
        status === 429
          ? 'Limite de pedidos atingido na fonte de dados. Aguarda ~1 minuto e tenta de novo.'
          : 'Não foi possível obter os jogos da fonte de dados. Verifica a ligação em Definições → Testar ligação.',
      );
      setRows([]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    data,
    filters.date,
    weights,
    oddsCalibration,
    recalibration,
    cacheFixtures,
    refreshKey,
    hideAmateur,
    majorOnly,
    hideStarted,
    batchSize,
    setFilters,
  ]);

  // Effect B — analyse the un-analysed fixtures within the current batch window.
  // Re-runs when the window grows ("Analisar mais"); cached/analysed games are
  // skipped via analyzedRef so growing the window only costs the new slice.
  useEffect(() => {
    if (fixtures.length === 0) return;
    let cancelled = false;
    const sig = sigRef.current;
    const window = Number.isFinite(batchLimit) ? fixtures.slice(0, batchLimit) : fixtures;
    const pending = window.filter((f) => !analyzedRef.current.has(f.id));
    if (pending.length === 0) return;
    (async () => {
      for (const fixture of pending) {
        if (cancelled) return;
        if (analyzedRef.current.has(fixture.id)) continue;
        const row = await buildDashboardRow(data, fixture, {
          weights,
          oddsCalibration,
          recalibration,
        });
        if (cancelled) return;
        // Persist successful analyses (predictionError rows are left to retry).
        if (row.prediction) {
          analyzedRef.current.add(fixture.id);
          void saveDayPrediction(filters.date, sig, fixture.id, row.prediction, row.markets);
        }
        setRows((prev) => prev.map((r) => (r.fixture.id === fixture.id ? row : r)));
      }
    })().catch((err: unknown) => {
      log.error('analysis batch failed', err);
    });
    return () => {
      cancelled = true;
    };
  }, [fixtures, batchLimit, data, weights, oddsCalibration, recalibration, filters.date]);

  const handleReanalyze = useCallback(async () => {
    await clearDayPredictions(filters.date);
    setRefreshKey((k) => k + 1);
  }, [filters.date]);

  const loadMore = useCallback(() => {
    setBatchLimit(
      (b) => (Number.isFinite(b) ? b : fixtures.length) + (batchSize || fixtures.length),
    );
  }, [batchSize, fixtures.length]);

  const favoriteCompetition = useSettings((s) => s.favoriteCompetition);
  const filtered = useMemo(
    () =>
      sortByFavourite(
        // Sort by the selected market's dominant probability so the strongest
        // games for that market appear on top, then apply filters. Sorting here
        // (not in setRows) avoids re-sorting on every per-fixture prediction.
        applyFilters(sortDashboardRowsByMarket(rows, market), filters),
        favoriteCompetition,
      ),
    [rows, filters, favoriteCompetition, market],
  );
  // Competition options are locked to the selected country.
  const competitions = useMemo(
    () => uniqueCompetitions(rows, filters.country),
    [rows, filters.country],
  );
  const countries = useMemo(() => uniqueCountries(rows), [rows]);

  // Batch progress: how many of the current window are done vs how many fixtures
  // are still waiting beyond the window.
  const predById = useMemo(() => new Map(rows.map((r) => [r.fixture.id, r.prediction])), [rows]);
  const batchIds = useMemo(
    () =>
      new Set(
        (Number.isFinite(batchLimit) ? fixtures.slice(0, batchLimit) : fixtures).map((f) => f.id),
      ),
    [fixtures, batchLimit],
  );
  const batchTotal = batchIds.size;
  const analyzedInBatch = useMemo(
    () => [...batchIds].filter((id) => predById.get(id)).length,
    [batchIds, predById],
  );
  const waiting = useMemo(
    () => fixtures.filter((f) => !batchIds.has(f.id) && !predById.get(f.id)).length,
    [fixtures, batchIds, predById],
  );
  const analyzing = batchTotal > 0 && analyzedInBatch < batchTotal;
  const nextBatch = Math.min(batchSize || waiting, waiting);
  const showWaiting = waiting > 0;

  const handleExport = useCallback(
    async (kind: 'csv' | 'xlsx' | 'pdf') => {
      try {
        if (kind === 'csv') await exportCsv(filtered);
        else if (kind === 'xlsx') await exportXlsx(filtered);
        else await exportPdf(filtered);
      } catch (err) {
        log.error('export failed', err);
      }
    },
    [filtered],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {filters.date === todayIso() ? 'Jogos de Hoje' : 'Jogos'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(filters.date)} · {filtered.length} jogo(s) · ordenados por{' '}
            {marketLabel(market)}
            {analyzing && ` · a analisar ${analyzedInBatch}/${batchTotal}…`}
            {showWaiting && ` · ${waiting} em espera`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fonte dos dados e análise:{' '}
            <span className="font-medium text-foreground">{getProvider(providerId).label}</span>
          </p>
          <QuotaBadge className="mt-1" />
        </div>
        {/* Right side, aligned with the title: options pop-up + Definições. */}
        <div className="flex items-center gap-2 self-start">
          {/* All page options live behind a single discreet pop-up, as icon-only
            controls; each reveals its label on hover or long-press. */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Opções"
                className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto overflow-visible p-2">
              <div className="grid max-w-[15rem] grid-cols-4 gap-2">
                <IconAction
                  label="Filtros"
                  icon={<SlidersHorizontal className="h-4 w-4" />}
                  active={showFilters}
                  onClick={() => setShowFilters((v) => !v)}
                />
                <IconAction
                  label="Reanalisar"
                  icon={<RefreshCw className="h-4 w-4" />}
                  onClick={() => setConfirmReanalyze(true)}
                />
                <IconAction
                  label={`Analisar mais ${nextBatch || ''}`.trim()}
                  icon={<PlusCircle className="h-4 w-4" />}
                  disabled={!showWaiting || analyzing}
                  onClick={loadMore}
                />
                <IconAction
                  label={majorOnly ? 'Só grandes ligas (ativo)' : 'Só grandes ligas'}
                  icon={<Trophy className="h-4 w-4" />}
                  active={majorOnly}
                  onClick={() => setMajorOnly(!majorOnly)}
                />
                <IconAction
                  label={hideStarted ? 'Esconder começados (ativo)' : 'Esconder começados'}
                  icon={<Clock className="h-4 w-4" />}
                  active={hideStarted}
                  onClick={() => setHideStarted(!hideStarted)}
                />
                <IconAction
                  label="Exportar CSV"
                  icon={<Download className="h-4 w-4" />}
                  disabled={!filtered.length}
                  onClick={() => handleExport('csv')}
                />
                <IconAction
                  label="Exportar Excel"
                  icon={<FileSpreadsheet className="h-4 w-4" />}
                  disabled={!filtered.length}
                  onClick={() => handleExport('xlsx')}
                />
                <IconAction
                  label="Exportar PDF"
                  icon={<FileText className="h-4 w-4" />}
                  disabled={!filtered.length}
                  onClick={() => handleExport('pdf')}
                />
              </div>
            </PopoverContent>
          </Popover>
          <Link
            to="/settings"
            aria-label="Definições"
            title="Definições"
            className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Market selector — the whole list/ranking adapts to the chosen market. */}
      <MarketSelector value={market} onChange={setMarket} />

      {analyzing && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>A analisar previsões…</span>
            <span>
              {analyzedInBatch}/{batchTotal}
              {showWaiting && ` · ${waiting} em espera`}
            </span>
          </div>
          <Progress value={analyzedInBatch} max={batchTotal} />
        </div>
      )}

      {showFilters && (
        <DashboardFilters
          value={filters}
          competitions={competitions}
          countries={countries}
          onChange={setFilters}
        />
      )}

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <Spinner label="A calcular previsões..." />
      ) : filtered.length === 0 && analyzing ? (
        <Spinner label={`A analisar previsões... (${analyzedInBatch}/${batchTotal})`} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarX className="h-8 w-8 text-muted-foreground" />}
          title={loadError ? 'Não foi possível carregar' : 'Sem jogos para os filtros selecionados'}
          description={
            loadError
              ? 'A fonte de dados não respondeu. Tenta novamente daqui a pouco.'
              : showWaiting
                ? `Há ${waiting} jogo(s) por analisar. Usa "Analisar mais" para continuar.`
                : fixtures.length === 0
                  ? 'Sem jogos por começar para os filtros atuais. Fora de época as ligas de clubes param, e os jogos que já começaram estão escondidos.'
                  : 'Experimente outra data ou reduza os filtros aplicados.'
          }
          action={
            fixtures.length === 0 && !loadError ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                {hideStarted && (
                  <Button variant="outline" size="sm" onClick={() => setHideStarted(false)}>
                    Mostrar jogos já começados
                  </Button>
                )}
                {majorOnly && (
                  <Button variant="outline" size="sm" onClick={() => setMajorOnly(false)}>
                    Mostrar todas as competições
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      ) : (
        <GamesTable rows={filtered} />
      )}

      <ConfirmDialog
        open={confirmReanalyze}
        onOpenChange={setConfirmReanalyze}
        title="Reanalisar jogos do dia?"
        description="Vai descartar as análises guardadas deste dia e analisar tudo de novo a partir da fonte ativa, consumindo novos pedidos à API. Queres continuar?"
        confirmLabel="Reanalisar"
        onConfirm={() => void handleReanalyze()}
      />
    </div>
  );
}
