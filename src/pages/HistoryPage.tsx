import { Fragment, useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFixtureCache } from '@/store/fixtureCacheStore';
import {
  History,
  Trash2,
  Download,
  Calendar as CalendarIcon,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
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
import { settleBetAgainstBtts, bttsFromGoals } from '@/services/settlementService';
import { ScoreInput } from '@/components/common/ScoreInput';
import { fetchFlashscoreByDate } from '@/services/flashscoreClient';
import type { FlashFixture } from '@/services/flashscoreMatches';
import { flashOutcome, buildFixtureIndex } from '@/services/flashscoreSettle';
import { FinancialDashboard } from '@/components/history/FinancialDashboard';
import { AddHistoryDialog } from '@/components/history/AddHistoryDialog';
import { EmptyState, Spinner } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3 } from 'lucide-react';
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
  Bar,
  BarChart,
  Cell,
  LabelList,
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  evaluate,
  reliabilityCurve,
  accuracyByConfidence,
  type Sample,
} from '@/core/backtest/backtest';
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

/** Colour for an accuracy value (green good, amber so-so, red poor). */
const accuracyColor = (acc: number): string =>
  acc >= 70 ? '#10b981' : acc >= 55 ? '#f59e0b' : '#ef4444';

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
  const navigate = useNavigate();
  const cacheFixtures = useFixtureCache((s) => s.put);
  const refreshCalibration = useCalibration((s) => s.refresh);
  const autoCalibrate = useSettings((s) => s.autoCalibrate);
  const corsProxy = useSettings((s) => s.corsProxy);
  const rapidApiKey = useSettings((s) => s.rapidApiKey);
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
  const [flashFetching, setFlashFetching] = useState(false);
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
  const VALID_TIERS = new Set<string>(['very-strong', 'strong', 'medium', 'weak']);
  const samples = useMemo<Sample[]>(
    () =>
      settled
        .filter((r) => {
          if (VALID_TIERS.has(r.tier as string)) return true;
          log.warn('invalid tier in history record, skipping from calibration', {
            id: r.id,
            tier: r.tier,
          });
          return false;
        })
        .map((r) => ({
          probYes: r.probYes,
          tier: r.tier as PredictionTier,
          outcome: r.actual === 'yes' ? 1 : 0,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settled],
  );
  const evaluation = useMemo(() => evaluate(samples), [samples]);
  // Hit-rate grouped by the shown prediction % (dominant side, 50–100%), for the
  // "Acerto por faixa" pop-up. Only bands that actually have games are charted.
  const confidenceBands = useMemo(
    () => accuracyByConfidence(samples, 10).filter((b) => b.n > 0),
    [samples],
  );
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

  // Enter a scoreline for a prediction → derive the BTTS outcome automatically.
  const setRecordScore = async (id: string, hg: number, ag: number): Promise<void> => {
    await setHistoryResult(id, bttsFromGoals(hg, ag), `${hg}-${ag}`);
    await load();
    await refreshCalibration();
  };

  // Enter a scoreline for a bet → derive the BTTS outcome and grade won/lost.
  const setBetScore = async (bet: Bet, hg: number, ag: number): Promise<void> => {
    const graded = settleBetAgainstBtts(bet, bttsFromGoals(hg, ag));
    if (!graded) return; // non-BTTS market we can't grade from a scoreline
    await setBetResult(bet.id, graded, `${hg}-${ag}`);
  };

  const handleDeleteRecord = async (id: string): Promise<void> => {
    await removeHistory(id);
    await load();
    await refreshCalibration();
  };

  // Update results from Flashscore (the only data source). We fetch the day list
  // for each pending game's date (finished games carry the final score; in-play
  // ones are included too), match by the stored Flashscore match id (Calculator
  // imports) first, then by team-name pair. Finished games settle both ways;
  // in-play games can only lock an early "yes" once both teams have scored.
  const handleFlashResults = async (): Promise<void> => {
    if (!rapidApiKey.trim()) {
      setFetchMsg('Configura a chave RapidAPI em Definições para usar o Flashscore.');
      return;
    }
    setFlashFetching(true);
    setFetchMsg(null);
    try {
      const pendingRecords = records.filter((r) => !r.actual);
      const pendingBets = bets.filter((b) => b.result === 'pending');

      // Unique match days to query (capped to bound API calls), newest last.
      const days = new Set<string>([todayIso()]);
      for (const r of pendingRecords) days.add(r.date.slice(0, 10));
      for (const b of pendingBets) days.add(new Date(b.createdAt).toISOString().slice(0, 10));
      const dayList = [...days].sort().slice(-21);

      const fixtures: FlashFixture[] = [];
      for (const d of dayList) {
        fixtures.push(...(await fetchFlashscoreByDate(rapidApiKey, corsProxy, d).catch(() => [])));
      }
      const idx = buildFixtureIndex(fixtures);

      let updated = 0;
      for (const r of pendingRecords) {
        const f = idx.find(r.flashMatchId, r.fixtureName);
        const o = f ? flashOutcome(f) : null;
        if (o) {
          await setHistoryResult(r.id, o.outcome, o.score);
          updated += 1;
        }
      }

      let betsSettled = 0;
      for (const b of pendingBets) {
        const f = idx.find(b.flashMatchId, b.matchLabel);
        const o = f ? flashOutcome(f) : null;
        if (!o) continue;
        const graded = settleBetAgainstBtts(b, o.outcome);
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
      setFetchMsg(
        parts.length > 0
          ? `Atualizado via Flashscore: ${parts.join(' e ')} (${idx.size} jogos em ${dayList.length} dia(s)).`
          : `Sem resultados aplicáveis (${idx.size} jogos verificados em ${dayList.length} dia(s)). Os jogos importados na Calculadora associam por id; os outros pelo nome exato das equipas.`,
      );
    } catch (err) {
      log.error('flash results failed', err);
      setFetchMsg('Falha ao buscar resultados do Flashscore (proxy, chave RapidAPI ou limite).');
    } finally {
      setFlashFetching(false);
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

  // Group the predictions by game day (newest day first) so each day can be
  // collapsed/expanded independently.
  const dayGroups = useMemo(() => {
    const byDay = new Map<string, HistoryRecord[]>();
    for (const r of filtered) {
      const key = (r.date || new Date(r.createdAt).toISOString()).slice(0, 10);
      const list = byDay.get(key);
      if (list) list.push(r);
      else byDay.set(key, [r]);
    }
    return Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const toggleDay = (day: string): void =>
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  const allCollapsed = dayGroups.length > 0 && collapsedDays.size >= dayGroups.length;
  const toggleAllDays = (): void =>
    setCollapsedDays(allCollapsed ? new Set() : new Set(dayGroups.map(([d]) => d)));

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

  // Kickoff time for a bet: the value stored on the bet, else borrowed from a
  // matching prediction record (same fixture). Lets older bets show a kickoff too.
  const historyDateByFixture = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of records) if (r.fixtureId && r.date) m.set(r.fixtureId, r.date);
    return m;
  }, [records]);
  const betKickoff = (b: Bet): string | undefined =>
    b.kickoff ?? (b.fixtureId ? historyDateByFixture.get(b.fixtureId) : undefined);

  // A bet opens its analysis when it carries a real (Flashscore) match id —
  // manual Calculator/Martingale bets ("manual-…") have no fixture to analyse.
  const betAnalysisId = (b: Bet): string | null => {
    if (b.flashMatchId) return b.flashMatchId;
    if (b.fixtureId && !b.fixtureId.startsWith('manual-')) return b.fixtureId;
    return null;
  };
  const openBetAnalysis = (b: Bet): void => {
    const id = betAnalysisId(b);
    if (!id) return;
    const [home, away] = b.matchLabel.split(' vs ');
    // Seed the cache so the analysis page can resolve this fixture by id.
    cacheFixtures([
      {
        id,
        date: betKickoff(b) ?? new Date().toISOString(),
        competition: { id: '', name: '' },
        home: { id: '', name: home ?? b.matchLabel },
        away: { id: '', name: away ?? '' },
      },
    ]);
    navigate(`/analysis/${encodeURIComponent(id)}`);
  };

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
                  {dayGroups.length > 1 && (
                    <Button variant="outline" size="sm" onClick={toggleAllDays}>
                      {allCollapsed ? (
                        <>
                          <ChevronDown /> Expandir tudo
                        </>
                      ) : (
                        <>
                          <ChevronRight /> Colapsar tudo
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFlashResults}
                    disabled={flashFetching}
                  >
                    <RefreshCw className={flashFetching ? 'animate-spin' : ''} /> Atualizar
                    resultados
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <BarChart3 /> Acerto por faixa
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-primary" /> Acerto por faixa de
                          probabilidade
                        </DialogTitle>
                        <DialogDescription>
                          Taxa de acerto das previsões já liquidadas, agrupadas pela percentagem
                          mostrada (o lado dominante, de 50% a 100%). Ajuda a ver que faixas são
                          mais fiáveis.
                        </DialogDescription>
                      </DialogHeader>
                      {confidenceBands.length === 0 ? (
                        <EmptyState
                          title="Sem dados suficientes"
                          description="Marca o resultado de alguns jogos para veres o acerto por faixa."
                        />
                      ) : (
                        <ResponsiveContainer
                          width="100%"
                          height={Math.max(160, confidenceBands.length * 48)}
                        >
                          <BarChart
                            layout="vertical"
                            data={confidenceBands}
                            margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
                          >
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                            <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} />
                            <YAxis
                              type="category"
                              dataKey="label"
                              width={56}
                              fontSize={11}
                              tickLine={false}
                            />
                            <RTooltip
                              formatter={(v: number, _n, p) => [
                                `${v}% acerto · ${p?.payload?.n ?? 0} jogo(s)`,
                                'Faixa',
                              ]}
                            />
                            <Bar
                              dataKey="accuracy"
                              radius={[0, 4, 4, 0]}
                              label={{
                                position: 'right',
                                formatter: (v: number) => `${v}%`,
                                fontSize: 11,
                              }}
                            >
                              {confidenceBands.map((b) => (
                                <Cell key={b.label} fill={accuracyColor(b.accuracy ?? 0)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Baseado em {samples.length} previsão(ões) liquidada(s). Verde ≥70% · amarelo
                        ≥55% · vermelho &lt;55%.
                      </p>
                    </DialogContent>
                  </Dialog>
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
                            formatter={(value, name, item) => {
                              const v = value as number | null;
                              if (name === 'actual') {
                                const n = (item?.payload?.n as number) ?? 0;
                                return [v == null ? '—' : `${v}% · ${n} jogo(s)`, 'Real'];
                              }
                              return [v == null ? '—' : `${v}%`, 'Ideal'];
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
                          >
                            <LabelList
                              dataKey="n"
                              position="top"
                              fontSize={10}
                              formatter={(n: number) => (n ? `${n}j` : '')}
                            />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Na curva de fiabilidade, quanto mais a linha "Real" colar à diagonal "Ideal",
                      melhor calibrado está o modelo. O número junto a cada ponto (ex.: "3j") é
                      quantos jogos há nessa faixa — pontos com poucos jogos são menos fiáveis.
                      Marque o resultado real dos jogos (abaixo) ou use "Atualizar resultados".
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
                      {dayGroups.map(([day, dayRecords]) => {
                        const collapsed = collapsedDays.has(day);
                        return (
                          <Fragment key={day}>
                            <TableRow
                              className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                              onClick={() => toggleDay(day)}
                            >
                              <TableCell colSpan={8} className="py-2">
                                <div className="flex items-center gap-2 font-medium">
                                  {collapsed ? (
                                    <ChevronRight className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                  {format(parseISO(day), 'dd/MM/yyyy')}
                                  <span className="text-xs font-normal text-muted-foreground">
                                    {dayRecords.length} jogo(s)
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                            {!collapsed &&
                              dayRecords.map((r) => (
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
                                  <TableCell className="hidden sm:table-cell">
                                    {r.confidence}/10
                                  </TableCell>
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
                                      <div className="flex flex-col gap-1.5">
                                        <ScoreInput
                                          onSubmit={(hg, ag) => void setRecordScore(r.id, hg, ag)}
                                        />
                                        <div className="flex items-center gap-1">
                                          <span className="hidden text-xs text-muted-foreground sm:inline">
                                            ou:
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
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden font-medium tabular-nums sm:table-cell">
                                    {r.actualScore ?? (
                                      <span className="text-muted-foreground">—</span>
                                    )}
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
                          </Fragment>
                        );
                      })}
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
                  onClick={handleFlashResults}
                  disabled={flashFetching}
                >
                  <RefreshCw className={flashFetching ? 'animate-spin' : ''} /> Atualizar resultados
                </Button>
              </div>
              <FinancialDashboard bets={bets} initialBankroll={initialBankroll} />
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Início do jogo</TableHead>
                      <TableHead>Jogo</TableHead>
                      <TableHead className="hidden sm:table-cell">Aposta feita</TableHead>
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
                      const kickoff = betKickoff(b);
                      const clickable = betAnalysisId(b) != null;
                      return (
                        <TableRow
                          key={b.id}
                          className={clickable ? 'cursor-pointer' : undefined}
                          onClick={clickable ? () => openBetAnalysis(b) : undefined}
                        >
                          <TableCell className="text-xs text-muted-foreground">
                            {kickoff ? formatDateTime(kickoff) : '—'}
                          </TableCell>
                          <TableCell className="font-medium">{b.matchLabel}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {formatDateTime(new Date(b.createdAt).toISOString())}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {b.market} {b.selection}
                          </TableCell>
                          <TableCell>{b.odds.toFixed(2)}</TableCell>
                          <TableCell>{EUR(b.stake)}</TableCell>
                          <TableCell>
                            {b.result === 'pending' ? (
                              <ScoreInput onSubmit={(hg, ag) => void setBetScore(b, hg, ag)} />
                            ) : (
                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span
                                  className={
                                    b.result === 'won'
                                      ? 'font-semibold text-success'
                                      : 'font-semibold text-destructive'
                                  }
                                >
                                  {b.result === 'won' ? 'Ganha' : 'Perdida'}
                                </span>
                                {b.score && (
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                    {b.score}
                                  </span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  aria-label="Limpar resultado"
                                  title="Limpar resultado"
                                  onClick={() => void setBetResult(b.id, 'pending')}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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
