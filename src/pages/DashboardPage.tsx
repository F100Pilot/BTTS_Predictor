import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { addDays, format } from 'date-fns';
import {
  CalendarX,
  Download,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { DashboardRow } from '@/domain/types';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { buildDashboardRow, sortDashboardRows } from '@/services/analysisService';
import { isMinorCompetition } from '@/core/classification/competitions';
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
  defaultFilters,
  sortByFavourite,
  uniqueCompetitions,
  uniqueCountries,
  type DashboardFilterState,
} from '@/components/dashboard/filters';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { GamesTable } from '@/components/dashboard/GamesTable';
import { useFixtureCache } from '@/store/fixtureCacheStore';
import { useCalibration } from '@/store/calibrationStore';
import { Spinner, EmptyState } from '@/components/common/States';
import { QuotaBadge } from '@/components/common/QuotaBadge';
import { Button } from '@/components/ui/button';
import { exportCsv, exportPdf, exportXlsx } from '@/services/exportService';

const log = createLogger('DashboardPage');

export function DashboardPage() {
  const data = useDataService();
  const weights = useSettings((s) => s.weights);
  const oddsCalibration = useSettings((s) => s.oddsCalibration);
  const autoCalibrate = useSettings((s) => s.autoCalibrate);
  const platt = useCalibration((s) => s.platt);
  const calibrationReady = useCalibration((s) => s.ready);
  const recalibration = autoCalibrate && calibrationReady ? platt : undefined;
  const hideAmateur = useSettings((s) => s.hideAmateur);
  const cacheFixtures = useFixtureCache((s) => s.put);
  const [filters, setFilters] = useState<DashboardFilterState>(() => defaultFilters(todayIso()));
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Auto-jump to the next day with games only once, on the initial load.
  const autoJumpDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    setLoadError(null);
    const sig = predictionSignature(weights, oddsCalibration, recalibration);
    (async () => {
      const allFixtures = await data.getFixturesByDate(filters.date);
      if (cancelled) return;
      // Drop amateur/youth/friendly games BEFORE analysis so we don't burn the
      // API budget on hundreds of minor matches that never finish analysing.
      const fixtures = hideAmateur
        ? allFixtures.filter((f) => !isMinorCompetition(f.competition.name))
        : allFixtures;

      // On first load, if the selected day has no games, jump to the next day
      // within the next 21 days that does (keeps the user from landing on empty).
      if (fixtures.length === 0 && !autoJumpDone.current) {
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

      cacheFixtures(fixtures);
      // Reuse any predictions already analysed for this day+settings; the rest
      // fill in progressively. Saved games never get re-analysed (saves API).
      const saved = await loadDayPredictions(filters.date, sig);
      if (cancelled) return;
      setRows(fixtures.map((fixture) => ({ fixture, prediction: saved[fixture.id] })));
      setLoading(false);
      for (const fixture of fixtures) {
        if (saved[fixture.id]) continue; // already analysed for this day
        const row = await buildDashboardRow(data, fixture, {
          weights,
          oddsCalibration,
          recalibration,
        });
        if (cancelled) return;
        // Persist successful analyses (predictionError rows are left to retry).
        if (row.prediction) {
          void saveDayPrediction(filters.date, sig, fixture.id, row.prediction);
        }
        setRows((prev) =>
          sortDashboardRows(prev.map((r) => (r.fixture.id === fixture.id ? row : r))),
        );
      }
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
  ]);

  const handleReanalyze = useCallback(async () => {
    await clearDayPredictions(filters.date);
    setRefreshKey((k) => k + 1);
  }, [filters.date]);

  const favoriteCompetition = useSettings((s) => s.favoriteCompetition);
  const filtered = useMemo(
    () => sortByFavourite(applyFilters(rows, filters), favoriteCompetition),
    [rows, filters, favoriteCompetition],
  );
  const competitions = useMemo(() => uniqueCompetitions(rows), [rows]);
  const countries = useMemo(() => uniqueCountries(rows), [rows]);
  const analyzedCount = useMemo(() => rows.filter((r) => r.prediction).length, [rows]);
  const analyzing = rows.length > 0 && analyzedCount < rows.length;

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
            {formatDate(filters.date)} · {filtered.length} jogo(s) · ordenados por BTTS=SIM
            {analyzing && ` · a analisar ${analyzedCount}/${rows.length}…`}
          </p>
          <QuotaBadge className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleReanalyze()}>
            <RefreshCw /> Reanalisar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!filtered.length}
            onClick={() => handleExport('csv')}
          >
            <Download /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!filtered.length}
            onClick={() => handleExport('xlsx')}
          >
            <FileSpreadsheet /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!filtered.length}
            onClick={() => handleExport('pdf')}
          >
            <FileText /> PDF
          </Button>
        </div>
      </div>

      <DashboardFilters
        value={filters}
        competitions={competitions}
        countries={countries}
        onChange={setFilters}
      />

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <Spinner label="A calcular previsões..." />
      ) : filtered.length === 0 && analyzing ? (
        <Spinner label={`A analisar previsões... (${analyzedCount}/${rows.length})`} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarX className="h-8 w-8 text-muted-foreground" />}
          title={loadError ? 'Não foi possível carregar' : 'Sem jogos para os filtros selecionados'}
          description={
            loadError
              ? 'A fonte de dados não respondeu. Tenta novamente daqui a pouco.'
              : 'Experimente outra data ou reduza os filtros aplicados.'
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <GamesTable rows={filtered} />
        </div>
      )}
    </div>
  );
}
