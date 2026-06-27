import { useEffect, useMemo, useState, useCallback } from 'react';
import { History, Trash2, Download, Calendar as CalendarIcon, X, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Bet, PredictionTier } from '@/domain/types';
import type { HistoryRecord } from '@/data/cache/db';
import {
  listHistory,
  clearHistory,
  setHistoryResult,
  removeHistory,
} from '@/data/cache/repositories';
import { useMartingale } from '@/store/martingaleStore';
import { bttsFromGoals, settleBetAgainstBtts } from '@/services/settlementService';
import { FinancialDashboard } from '@/components/history/FinancialDashboard';
import { AddHistoryDialog } from '@/components/history/AddHistoryDialog';
import { EmptyState, Spinner } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { bttsVerdict } from '@/core/classification/classification';
import { winProfit } from '@/core/martingale/martingale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TierBadge } from '@/components/common/PredictionWidgets';
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
const EUR = (n: number): string => `€${n.toFixed(2)}`;

/** Keep one prediction per fixture (latest), removing legacy duplicates. */
function dedupeByFixture(records: HistoryRecord[]): HistoryRecord[] {
  const byFixture = new Map<string, HistoryRecord>();
  for (const r of records) {
    const key = r.fixtureId || r.id;
    const existing = byFixture.get(key);
    if (!existing || r.createdAt > existing.createdAt) byFixture.set(key, r);
  }
  return Array.from(byFixture.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function HistoryPage() {
  const data = useDataService();
  const refreshCalibration = useCalibration((s) => s.refresh);
  const autoCalibrate = useSettings((s) => s.autoCalibrate);
  const providerId = useSettings((s) => s.providerId);
  const initialBankroll = useMartingale((s) => s.initialBankroll);
  // Read bets from the Martingale store so settlements made here (or there)
  // stay in sync across pages instead of living in a separate local copy.
  const bets = useMartingale((s) => s.bets);
  const refreshBets = useMartingale((s) => s.refresh);
  const setBetResult = useMartingale((s) => s.setResult);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [hist] = await Promise.all([listHistory(), refreshBets()]);
    setRecords(dedupeByFixture(hist));
    setLoading(false);
  }, [refreshBets]);

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

  const handleDeleteRecord = async (id: string): Promise<void> => {
    await removeHistory(id);
    await load();
    await refreshCalibration();
  };

  const handleFetchResults = async (): Promise<void> => {
    setFetching(true);
    setFetchMsg(null);
    try {
      const today = todayIso();
      // Only settle games whose fixtureId came from the ACTIVE provider — ids are
      // provider-specific, so fetching a result for an id created by another
      // source returns a different match (wrong score). Mismatched/legacy
      // (untagged) records are skipped and reported.
      const isPlayable = (date: string): boolean => date.slice(0, 10) <= today;
      const pendingRecords = records.filter(
        (r) => !r.actual && r.fixtureId && isPlayable(r.date) && r.providerId === providerId,
      );
      const pendingBets = bets.filter(
        (b) => b.result === 'pending' && b.fixtureId && b.providerId === providerId,
      );
      const skipped =
        records.filter(
          (r) => !r.actual && r.fixtureId && isPlayable(r.date) && r.providerId !== providerId,
        ).length +
        bets.filter((b) => b.result === 'pending' && b.fixtureId && b.providerId !== providerId)
          .length;

      // BTTS=SIM is locked the moment both teams have scored, even mid-game —
      // use the live feed to early-settle "yes". Final results settle both ways.
      const live = await data.getLiveMatches().catch(() => []);
      const liveById = new Map(live.map((l) => [l.id, l]));

      // One result lookup per unique fixture (shared between predictions + bets).
      const fixtureIds = Array.from(
        new Set([
          ...pendingRecords.map((r) => r.fixtureId!),
          ...pendingBets.map((b) => b.fixtureId!),
        ]),
      );
      const resultById = new Map<string, Awaited<ReturnType<typeof data.getMatchResultById>>>();
      for (const id of fixtureIds) {
        resultById.set(id, await data.getMatchResultById(id).catch(() => null));
      }

      // Resolve the BTTS outcome for a fixture: final result first, else an
      // early "yes" from the live feed (a finished 1-0 only settles via result).
      const outcomeFor = (fixtureId: string): 'yes' | 'no' | null => {
        const res = resultById.get(fixtureId);
        if (res) return bttsFromGoals(res.homeGoals, res.awayGoals);
        const lm = liveById.get(fixtureId);
        if (lm && lm.homeGoals > 0 && lm.awayGoals > 0) return 'yes';
        return null;
      };

      // Final scoreline (only from a finished result, not the live feed).
      const scoreFor = (fixtureId: string): string | undefined => {
        const res = resultById.get(fixtureId);
        return res ? `${res.homeGoals}-${res.awayGoals}` : undefined;
      };

      let updated = 0;
      for (const r of pendingRecords) {
        const outcome = outcomeFor(r.fixtureId!);
        if (outcome) {
          await setHistoryResult(r.id, outcome, scoreFor(r.fixtureId!));
          updated += 1;
        }
      }

      let betsSettled = 0;
      for (const b of pendingBets) {
        const outcome = outcomeFor(b.fixtureId!);
        if (!outcome) continue;
        const graded = settleBetAgainstBtts(b, outcome);
        if (graded) {
          await setBetResult(b.id, graded);
          betsSettled += 1;
        }
      }

      await load();
      await refreshCalibration();
      const parts: string[] = [];
      if (updated > 0) parts.push(`${updated} previsão(ões)`);
      if (betsSettled > 0) parts.push(`${betsSettled} aposta(s)`);
      const skipNote =
        skipped > 0
          ? ` ${skipped} jogo(s) de outra fonte ignorado(s) — apaga e volta a adicionar com a fonte atual.`
          : '';
      setFetchMsg(
        (parts.length > 0
          ? `Atualizado: ${parts.join(' e ')}.`
          : 'Sem novos resultados disponíveis (fonte/plano podem não os fornecer).') + skipNote,
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

  const betProfit = (b: Bet): number =>
    b.result === 'won' ? winProfit(b.stake, b.odds) : b.result === 'lost' ? -b.stake : 0;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Histórico</h1>
      <Tabs defaultValue="predictions">
        <TabsList>
          <TabsTrigger value="predictions">Previsões</TabsTrigger>
          <TabsTrigger value="bets">Apostas</TabsTrigger>
        </TabsList>

        <TabsContent value="predictions" className="space-y-3">
          <div className="flex justify-end">
            <AddHistoryDialog onAdded={() => void load()} />
          </div>
          {records.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8 text-muted-foreground" />}
              title="Sem previsões"
              description="As previsões que consultar serão guardadas aqui automaticamente, ou adicione um jogo manualmente."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchResults}
                    disabled={fetching}
                  >
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
                              <TableCell className="text-muted-foreground">
                                {t.avgPredicted}%
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {t.actualRate}%
                              </TableCell>
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
                          <YAxis
                            domain={[0, 100]}
                            ticks={[0, 25, 50, 75, 100]}
                            fontSize={11}
                            unit="%"
                          />
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
                      Na curva de fiabilidade, quanto mais a linha "Real" colar à diagonal "Ideal",
                      melhor calibrado está o modelo. Marque o resultado real dos jogos (abaixo) ou
                      use "Atualizar resultados".
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
                        <TableHead>Início do jogo</TableHead>
                        <TableHead>Jogo</TableHead>
                        <TableHead>BTTS</TableHead>
                        <TableHead className="hidden sm:table-cell">Confiança</TableHead>
                        <TableHead className="hidden md:table-cell">Classificação</TableHead>
                        <TableHead>Resultado real</TableHead>
                        <TableHead className="hidden sm:table-cell">Score</TableHead>
                        <TableHead className="w-10 text-right" aria-label="Ações" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.date ? formatDateTime(r.date) : '—'}
                          </TableCell>
                          <TableCell className="font-medium">{r.fixtureName}</TableCell>
                          <TableCell>
                            {(() => {
                              const v = bttsVerdict(r.probYes);
                              return (
                                <span
                                  className={
                                    v.side === 'SIM'
                                      ? 'font-semibold text-primary'
                                      : 'font-semibold'
                                  }
                                >
                                  {v.side} {toPercent(v.probability)}
                                </span>
                              );
                            })()}
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
                              <div className="flex items-center gap-1">
                                <span className="hidden text-xs text-muted-foreground sm:inline">
                                  Marcar:
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => void setResult(r.id, 'yes')}
                                >
                                  BTTS SIM
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => void setResult(r.id, 'no')}
                                >
                                  BTTS NÃO
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden font-medium tabular-nums sm:table-cell">
                            {r.actualScore ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Apagar jogo"
                              title="Apagar jogo"
                              onClick={() => void handleDeleteRecord(r.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="bets" className="space-y-3">
          {bets.length === 0 ? (
            <EmptyState
              title="Sem apostas"
              description="Adicione apostas na secção Martingale (ou a partir da análise de um jogo)."
            />
          ) : (
            <>
              <div className="flex items-center justify-end gap-2">
                {fetchMsg && <span className="text-sm text-muted-foreground">{fetchMsg}</span>}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchResults}
                  disabled={fetching}
                >
                  <RefreshCw className={fetching ? 'animate-spin' : ''} /> Atualizar resultados
                </Button>
              </div>
              <FinancialDashboard bets={bets} initialBankroll={initialBankroll} />
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Jogo</TableHead>
                      <TableHead className="hidden sm:table-cell">Seleção</TableHead>
                      <TableHead>Odd</TableHead>
                      <TableHead>Stake</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Lucro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bets.map((b) => {
                      const profit = betProfit(b);
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(new Date(b.createdAt).toISOString())}
                          </TableCell>
                          <TableCell className="font-medium">{b.matchLabel}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {b.market} {b.selection}
                          </TableCell>
                          <TableCell>{b.odds.toFixed(2)}</TableCell>
                          <TableCell>{EUR(b.stake)}</TableCell>
                          <TableCell>
                            {b.result === 'won' && (
                              <span className="font-semibold text-success">Ganha</span>
                            )}
                            {b.result === 'lost' && (
                              <span className="font-semibold text-destructive">Perdida</span>
                            )}
                            {b.result === 'pending' && (
                              <span className="text-warning">Pendente</span>
                            )}
                          </TableCell>
                          <TableCell
                            className={
                              profit > 0
                                ? 'font-semibold text-success'
                                : profit < 0
                                  ? 'font-semibold text-destructive'
                                  : 'text-muted-foreground'
                            }
                          >
                            {b.result === 'pending' ? '—' : EUR(profit)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Gerido na secção Martingale. Aqui vês o histórico completo das tuas apostas.
              </p>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
