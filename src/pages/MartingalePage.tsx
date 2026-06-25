import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Check, X, RotateCcw, Trash2, Plus, Download, Clock } from 'lucide-react';
import { useMartingale } from '@/store/martingaleStore';
import { activeSeries, computeStats } from '@/core/martingale/martingale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/States';
import { formatDateTime } from '@/lib/format';
import { sanitizeNumber, sanitizeText } from '@/services/sanitize';
import { createLogger } from '@/services/logger';

const log = createLogger('MartingalePage');
const EUR = (n: number) => `€${n.toFixed(2)}`;

interface PrefillState {
  matchLabel?: string;
  selection?: string;
  odds?: number;
  fixtureId?: string;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function MartingalePage() {
  const prefill = (useLocation().state ?? {}) as PrefillState;
  const {
    initialBankroll,
    baseProfit,
    seriesResetAt,
    bets,
    refresh,
    setSettings,
    nextStake,
    addBet,
    setResult,
    deleteBet,
    resetSeries,
    clearAll,
  } = useMartingale();

  const [matchLabel, setMatchLabel] = useState(prefill.matchLabel ?? '');
  const [market, setMarket] = useState('BTTS');
  const [selection, setSelection] = useState(prefill.selection ?? 'SIM');
  const [odds, setOdds] = useState(prefill.odds ? String(prefill.odds) : '');
  const [fixtureId] = useState(prefill.fixtureId);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => computeStats(bets, initialBankroll), [bets, initialBankroll]);
  const series = useMemo(() => activeSeries(bets, seriesResetAt), [bets, seriesResetAt]);
  const oddsVal = Number(odds);
  const previewStake = oddsVal > 1 ? nextStake(oddsVal) : 0;

  const handleAdd = async (): Promise<void> => {
    if (!(oddsVal > 1) || !matchLabel.trim()) return;
    await addBet({
      matchLabel: sanitizeText(matchLabel, 80),
      market: sanitizeText(market, 24) || 'BTTS',
      selection: sanitizeText(selection, 16) || 'SIM',
      odds: oddsVal,
      fixtureId,
    });
    setMatchLabel('');
    setOdds('');
  };

  const handleExport = async (): Promise<void> => {
    try {
      const { default: Papa } = await import('papaparse');
      const csv = Papa.unparse(
        bets.map((b) => ({
          Data: formatDateTime(new Date(b.createdAt).toISOString()),
          Jogo: b.matchLabel,
          Mercado: b.market,
          Selecao: b.selection,
          Odd: b.odds,
          Stake: b.stake,
          Step: b.step,
          Resultado: b.result === 'won' ? 'Ganha' : b.result === 'lost' ? 'Perdida' : 'Pendente',
        })),
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'martingale.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      log.error('export failed', err);
    }
  };

  const pieData = [
    { name: 'Ganhas', value: stats.wins, color: '#10b981' },
    { name: 'Perdidas', value: stats.losses, color: '#ef4444' },
    { name: 'Pendentes', value: stats.pending, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Martingale</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de banca com staking recuperativo: a stake é calculada para que uma vitória
          recupere as perdas da série e garanta o lucro base.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Banca"
          value={EUR(stats.bankroll)}
          hint={`Inicial ${EUR(initialBankroll)}`}
        />
        <StatCard label="Lucro total" value={EUR(stats.totalProfit)} hint={`ROI ${stats.roi}%`} />
        <StatCard
          label="G / P / Pend"
          value={`${stats.wins} / ${stats.losses} / ${stats.pending}`}
          hint={`Winrate ${stats.winrate}%`}
        />
        <StatCard
          label="Série ativa"
          value={`Step ${series.step}`}
          hint={`Perda acum. ${EUR(series.currentLoss)}`}
        />
      </div>

      {/* Settings + Add bet */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Configuração</CardTitle>
            <CardDescription>Banca inicial e lucro alvo por aposta vencedora.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bankroll">Banca inicial (€)</Label>
              <Input
                id="bankroll"
                type="number"
                min={0}
                value={initialBankroll}
                onChange={(e) =>
                  setSettings({
                    initialBankroll: sanitizeNumber(e.target.value, {
                      min: 0,
                      max: 1e9,
                      fallback: initialBankroll,
                    }),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="baseprofit">Lucro base (€)</Label>
              <Input
                id="baseprofit"
                type="number"
                min={0}
                value={baseProfit}
                onChange={(e) =>
                  setSettings({
                    baseProfit: sanitizeNumber(e.target.value, {
                      min: 0,
                      max: 1e9,
                      fallback: baseProfit,
                    }),
                  })
                }
              />
            </div>
            <div className="col-span-2 flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={resetSeries}>
                <RotateCcw /> Reiniciar série
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!bets.length}>
                <Download /> Exportar CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void clearAll()}
                disabled={!bets.length}
              >
                <Trash2 /> Limpar tudo
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nova aposta</CardTitle>
            <CardDescription>
              Stake sugerida para esta série: <strong>{EUR(previewStake)}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="match">Jogo</Label>
              <Input
                id="match"
                placeholder="Ex.: Benfica vs Porto"
                value={matchLabel}
                onChange={(e) => setMatchLabel(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Mercado</Label>
                <Input value={market} onChange={(e) => setMarket(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Seleção</Label>
                <Select value={selection} onValueChange={setSelection}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIM">SIM</SelectItem>
                    <SelectItem value="NÃO">NÃO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="odds">Odd</Label>
                <Input
                  id="odds"
                  type="number"
                  step="0.01"
                  min={1.01}
                  placeholder="2.00"
                  value={odds}
                  onChange={(e) => setOdds(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={!(oddsVal > 1) || !matchLabel.trim()}>
              <Plus /> Adicionar aposta ({EUR(previewStake)})
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {stats.equity.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução do lucro</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.equity}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => EUR(v)} />
                  <Line type="monotone" dataKey="profit" stroke="#10b981" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resultados</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bets table */}
      {bets.length === 0 ? (
        <EmptyState
          title="Sem apostas registadas"
          description="Adicione uma aposta acima, ou use 'Adicionar à Martingale' a partir da análise de um jogo."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jogo</TableHead>
                <TableHead className="hidden sm:table-cell">Seleção</TableHead>
                <TableHead>Odd</TableHead>
                <TableHead>Stake</TableHead>
                <TableHead className="hidden md:table-cell">Step</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bets.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.matchLabel}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {b.market} {b.selection}
                  </TableCell>
                  <TableCell>{b.odds.toFixed(2)}</TableCell>
                  <TableCell>{EUR(b.stake)}</TableCell>
                  <TableCell className="hidden md:table-cell">{b.step}</TableCell>
                  <TableCell>
                    {b.result === 'won' && (
                      <span className="font-semibold text-success">Ganha</span>
                    )}
                    {b.result === 'lost' && (
                      <span className="font-semibold text-destructive">Perdida</span>
                    )}
                    {b.result === 'pending' && <span className="text-warning">Pendente</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Ganha"
                        onClick={() => void setResult(b.id, 'won')}
                      >
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Perdida"
                        onClick={() => void setResult(b.id, 'lost')}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Pendente"
                        onClick={() => void setResult(b.id, 'pending')}
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar"
                        onClick={() => void deleteBet(b.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Aviso: o sistema Martingale aumenta a exposição após cada derrota e pode esgotar a banca
        rapidamente. Use apenas com fins informativos e aposte com responsabilidade.
      </p>
    </div>
  );
}
