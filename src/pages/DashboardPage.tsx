import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { addDays, format } from 'date-fns';
import { CalendarX, Download, FileSpreadsheet, FileText } from 'lucide-react';
import type { DashboardRow } from '@/domain/types';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { buildDashboardRow, sortDashboardRows } from '@/services/analysisService';
import { todayIso, formatDate } from '@/lib/format';
import { createLogger } from '@/services/logger';
import {
  applyFilters,
  defaultFilters,
  uniqueCompetitions,
  uniqueCountries,
  type DashboardFilterState,
} from '@/components/dashboard/filters';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { GamesTable } from '@/components/dashboard/GamesTable';
import { useFixtureCache } from '@/store/fixtureCacheStore';
import { Spinner, EmptyState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { exportCsv, exportPdf, exportXlsx } from '@/services/exportService';

const log = createLogger('DashboardPage');

export function DashboardPage() {
  const data = useDataService();
  const weights = useSettings((s) => s.weights);
  const cacheFixtures = useFixtureCache((s) => s.put);
  const [filters, setFilters] = useState<DashboardFilterState>(() => defaultFilters(todayIso()));
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Auto-jump to the next day with games only once, on the initial load.
  const autoJumpDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    (async () => {
      const fixtures = await data.getFixturesByDate(filters.date);
      if (cancelled) return;

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
      // Show the fixtures immediately; predictions fill in progressively so the
      // table is never empty while waiting on (rate-limited) API calls.
      setRows(fixtures.map((fixture) => ({ fixture })));
      setLoading(false);
      for (const fixture of fixtures) {
        const row = await buildDashboardRow(data, fixture, { weights });
        if (cancelled) return;
        setRows((prev) =>
          sortDashboardRows(prev.map((r) => (r.fixture.id === fixture.id ? row : r))),
        );
      }
    })().catch((err) => {
      log.error('failed to load dashboard', err);
      if (!cancelled) {
        setRows([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data, filters.date, weights, cacheFixtures]);

  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const competitions = useMemo(() => uniqueCompetitions(rows), [rows]);
  const countries = useMemo(() => uniqueCountries(rows), [rows]);

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
          </p>
        </div>
        <div className="flex gap-2">
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

      {loading ? (
        <Spinner label="A calcular previsões..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarX className="h-8 w-8 text-muted-foreground" />}
          title="Sem jogos para os filtros selecionados"
          description="Experimente outra data ou reduza os filtros aplicados."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <GamesTable rows={filtered} />
        </div>
      )}
    </div>
  );
}
