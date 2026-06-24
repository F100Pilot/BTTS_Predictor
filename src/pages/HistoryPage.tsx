import { useEffect, useState, useCallback } from 'react';
import { History, Trash2, Download } from 'lucide-react';
import type { HistoryRecord } from '@/data/cache/db';
import { listHistory, clearHistory } from '@/data/cache/repositories';
import { EmptyState, Spinner } from '@/components/common/States';
import { Button } from '@/components/ui/button';
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

export function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setRecords(await listHistory());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Histórico de Previsões</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 /> Limpar
          </Button>
        </div>
      </div>
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
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(new Date(r.createdAt).toISOString())}
                </TableCell>
                <TableCell className="font-medium">{r.fixtureName}</TableCell>
                <TableCell className="font-semibold text-primary">{toPercent(r.probYes)}</TableCell>
                <TableCell className="hidden sm:table-cell">{r.confidence}/10</TableCell>
                <TableCell className="hidden md:table-cell">
                  <TierBadge tier={r.tier as PredictionTier} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
