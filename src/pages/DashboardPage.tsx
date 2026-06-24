import { useEffect, useMemo, useState, useCallback } from 'react';
import { CalendarX, Download, FileSpreadsheet, FileText } from 'lucide-react';
import type { DashboardRow } from '@/domain/types';
import { useDataService } from '@/hooks/useDataService';
import { useSettings } from '@/store/settingsStore';
import { buildDashboardRows } from '@/services/analysisService';
import { todayIso } from '@/lib/format';
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const fixtures = await data.getFixturesByDate(filters.date);
        cacheFixtures(fixtures);
        const built = await buildDashboardRows(data, fixtures, { weights });
        if (!cancelled) setRows(built);
      } catch (err) {
        log.error('failed to load dashboard', err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
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
          <h1 className="text-2xl font-bold">Jogos de Hoje</h1>
          <p className="text-sm text-muted-foreground">
            Ordenados por probabilidade de BTTS=SIM. {filtered.length} jogo(s).
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
