import { useEffect, useMemo, useState, useCallback } from 'react';
import { History, Trash2, Download, Calendar as CalendarIcon, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { HistoryRecord } from '@/data/cache/db';
import { listHistory, clearHistory } from '@/data/cache/repositories';
import { EmptyState, Spinner } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TierBadge } from '@/components/common/PredictionWidgets';
import type { PredictionTier } from '@/domain/types';
import { formatDateTime } from '@/lib/format';
import { toPercent } from '@/lib/math';
import { exportCsv } from '@/services/exportService';
import { createLogger } from '@/services/logger';

const log = createLogger('HistoryPage');

const dayKey = (ms: number): string => format(new Date(ms), 'yyyy-MM-dd');

export function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRecords(await listHistory());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markedDays = useMemo(
    () => Array.from(new Set(records.map((r) => dayKey(r.createdAt)))).map((d) => parseISO(d)),
    [records],
  );
  const filtered = useMemo(
    () => (dateFilter ? records.filter((r) => dayKey(r.createdAt) === dateFilter) : records),
    [records, dateFilter],
  );

  const handleClear = async (): Promise<void> => {
    await clearHistory();
    await load();
  };

  const handleExport = async (): Promise<void> => {
    try {
      await exportCsv(
        records.map((r) => ({
          fixture: {
            id: r.fixtureId,
            date: r.date,
            competition: { id: '', name: r.competition },
            home: { id: '', name: r.fixtureName.split(' vs ')[0] ?? '' },
            away: { id: '', name: r.fixtureName.split(' vs ')[1] ?? '' },
          },
          prediction: {
            probYes: r.probYes,
            probNo: r.probNo,
            confidence: r.confidence,
            tier: r.tier as PredictionTier,
            factors: [],
          },
        })),
        'btts-historico.csv',
      );
    } catch (err) {
      log.error('export failed', err);
    }
  };

  if (loading) return <Spinner />;

  if (records.length === 0)
    return (
      <EmptyState
        icon={<History className="h-8 w-8 text-muted-foreground" />}
        title="Sem histórico"
        description="As previsões que consultar serão guardadas aqui automaticamente."
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Histórico de Previsões</h1>
        <div className="flex flex-wrap gap-2">
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon />{' '}
                {dateFilter ? format(parseISO(dateFilter), 'dd/MM/yyyy') : 'Por data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Calendar
                mode="single"
                selected={dateFilter ? parseISO(dateFilter) : undefined}
                defaultMonth={dateFilter ? parseISO(dateFilter) : undefined}
                onSelect={(d) => {
                  if (d) setDateFilter(format(d, 'yyyy-MM-dd'));
                  setCalOpen(false);
                }}
                modifiers={{ hasRecords: markedDays }}
                modifiersClassNames={{
                  hasRecords:
                    'font-semibold after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary',
                }}
              />
            </PopoverContent>
          </Popover>
          {dateFilter && (
            <Button variant="ghost" size="sm" onClick={() => setDateFilter(null)}>
              <X /> Todas
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 /> Limpar
          </Button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="Sem registos nesta data"
          description="Escolha outra data ou veja todas."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Jogo</TableHead>
                <TableHead>BTTS</TableHead>
                <TableHead className="hidden sm:table-cell">Confiança</TableHead>
                <TableHead className="hidden md:table-cell">Classificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(r.createdAt).toISOString())}
                  </TableCell>
                  <TableCell className="font-medium">{r.fixtureName}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    {toPercent(r.probYes)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{r.confidence}/10</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <TierBadge tier={r.tier as PredictionTier} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
