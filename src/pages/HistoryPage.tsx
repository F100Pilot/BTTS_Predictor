import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  History,
  Trash2,
  Download,
  Calendar as CalendarIcon,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { HistoryRecord } from '@/data/cache/db';
import { listHistory, clearHistory, setHistoryResult } from '@/data/cache/repositories';
import { EmptyState, Spinner } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { evaluate, reliabilityCurve, type Sample } from '@/core/backtest/backtest';
import { useDataService } from '@/hooks/useDataService';
import { useCalibration, MIN_CALIBRATION_SAMPLES } from '@/store/calibrationStore';
import { useSettings } from '@/store/settingsStore';
import { todayIso, formatDateTime } from '@/lib/format';
import { toPercent } from '@/lib/math';
import { exportCsv } from '@/services/exportService';
import { createLogger } from '@/services/logger';

const log = createLogger('HistoryPage');

const dayKey = (ms: number): string => format(new Date(ms), 'yyyy-MM-dd');
const predictedSide = (probYes: number): 'yes' | 'no' => (probYes >= 0.5 ? 'yes' : 'no');

export function HistoryPage() {
  const data = useDataService();
  const refreshCalibration = useCalibration((s) => s.refresh);
  const autoCalibrate = useSettings((s) => s.autoCalibrate);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRecords(await listHistory());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const settled = useMemo(
    () => records.filter((r) => r.actual === 'yes' || r.actual === 'no'),
    [records],
  );
  const samples = useMemo<Sample[]>(
    () =>
      settled.map((r) => ({
        probYes: r.probYes,
        tier: r.tier as PredictionTier,
        outcome: r.actual === 'yes' ? 1 : 0,
      })),
    [settled],
  );
  const evaluation = useMemo(() => evaluate(samples), [samples]);
  const reliability = useMemo(
    () =>
      reliabilityCurve(samples, 5).map((b) => ({
        predicted: b.predicted,
        actual: b.actual,
        ideal: b.predicted,
        n: b.n,
      })),
    [samples],
  );

  const setResult = async (id: string, actual: 'yes' | 'no' | undefined): Promise<void> => {
    await setHistoryResult(id, actual);
    await load();
    await refreshCalibration();
  };

  const handleFetchResults = async (): Promise<void> => {
    setFetching(true);
    setFetchMsg(null);
    try {
      const today = todayIso();
      const pending = records.filter(
        (r) => !r.actual && r.fixtureId && r.date.slice(0, 10) <= today,
      );
      let updated = 0;
      for (const r of pending) {
        const result = await data.getMatchResultById(r.fixtureId);
        if (!result) continue;
        const btts = result.homeGoals > 0 && result.awayGoals > 0 ? 'yes' : 'no';
        await setHistoryResult(r.id, btts);
        updated += 1;
      }
      await load();
      await refreshCalibration();
      setFetchMsg(
        updated > 0
          ? `${updated} resultado(s) atualizado(s).`
          : 'Sem novos resultados disponíveis (fonte/plano podem não os fornecer).',
      );
    } catch (err) {
      log.error('fetch results failed', err);
      setFetchMsg('Falha ao buscar resultados.');
    } finally {
      setFetching(false);
    }
  };

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
          <Button variant="outline" size="sm" onClick={handleFetchResults} disabled={fetching}>
            <RefreshCw className={fetching ? 'animate-spin' : ''} /> Atualizar resultados
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 /> Limpar
          </Button>
        </div>
      </div>

      {fetchMsg && <p className="text-sm text-muted-foreground">{fetchMsg}</p>}

      {/* Backtesting / desempenho */}
      {evaluation.overall.n > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Desempenho do modelo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Acerto</span>
                <p className="text-lg font-bold">{evaluation.overall.accuracy}%</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Brier (↓ melhor)</span>
                <p className="text-lg font-bold">{evaluation.overall.brier}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Amostras</span>
                <p className="text-lg font-bold">{evaluation.overall.n}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Auto-calibração</span>
                <p className="text-sm font-medium">
                  {!autoCalibrate
                    ? 'desligada'
                    : evaluation.overall.n >= MIN_CALIBRATION_SAMPLES
                      ? 'ativa ✓'
                      : `aguarda dados (${evaluation.overall.n}/${MIN_CALIBRATION_SAMPLES})`}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Amostras</TableHead>
                    <TableHead>Acerto</TableHead>
                    <TableHead>Previsto méd.</TableHead>
                    <TableHead>Real (BTTS)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluation.byTier.map((t) => (
                    <TableRow key={t.tier}>
                      <TableCell>
                        <TierBadge tier={t.tier as PredictionTier} />
                      </TableCell>
                      <TableCell>{t.n}</TableCell>
                      <TableCell className="font-semibold">{t.accuracy}%</TableCell>
                      <TableCell className="text-muted-foreground">{t.avgPredicted}%</TableCell>
                      <TableCell className="text-muted-foreground">{t.actualRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Curva de fiabilidade (previsto vs real)
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={reliability}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="predicted"
                    type="number"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    fontSize={11}
                    unit="%"
                  />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} fontSize={11} unit="%" />
                  <RTooltip
                    formatter={(value, name) => {
                      const v = value as number | null;
                      const label = name === 'actual' ? 'Real' : 'Ideal';
                      return [v == null ? '—' : `${v}%`, label];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    name="Ideal"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Real"
                    stroke="#10b981"
                    connectNulls
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground">
              Na curva de fiabilidade, quanto mais a linha "Real" colar à diagonal "Ideal", melhor
              calibrado está o modelo. Marque o resultado real dos jogos (abaixo) ou use "Atualizar
              resultados".
            </p>
          </CardContent>
        </Card>
      )}

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
                <TableHead>Resultado real</TableHead>
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
                  <TableCell>
                    {r.actual ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            r.actual === predictedSide(r.probYes)
                              ? 'font-semibold text-success'
                              : 'font-semibold text-destructive'
                          }
                        >
                          BTTS {r.actual === 'yes' ? 'SIM' : 'NÃO'}
                          {r.actual === predictedSide(r.probYes) ? ' ✓' : ' ✗'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Limpar resultado"
                          onClick={() => void setResult(r.id, undefined)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => void setResult(r.id, 'yes')}
                        >
                          <Check className="h-3.5 w-3.5" /> SIM
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => void setResult(r.id, 'no')}
                        >
                          <X className="h-3.5 w-3.5" /> NÃO
                        </Button>
                      </div>
                    )}
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
