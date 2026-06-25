import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Bet } from '@/domain/types';
import { computeStats, winProfit } from '@/core/martingale/martingale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const EUR = (n: number): string => `€${n.toFixed(2)}`;

function betProfit(b: Bet): number {
  return b.result === 'won' ? winProfit(b.stake, b.odds) : b.result === 'lost' ? -b.stake : 0;
}

interface MonthBucket {
  month: string; // yyyy-MM
  label: string; // MM/yy
  profit: number;
  staked: number;
  bets: number;
}

/** Group settled bets by calendar month (by settle/creation time). */
function monthlyBreakdown(bets: Bet[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const b of bets) {
    if (b.result === 'pending') continue;
    const when = b.settledAt ?? b.createdAt;
    const month = format(new Date(when), 'yyyy-MM');
    const bucket = map.get(month) ?? {
      month,
      label: format(new Date(when), 'MM/yy'),
      profit: 0,
      staked: 0,
      bets: 0,
    };
    bucket.profit = Math.round((bucket.profit + betProfit(b)) * 100) / 100;
    bucket.staked = Math.round((bucket.staked + b.stake) * 100) / 100;
    bucket.bets += 1;
    map.set(month, bucket);
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

interface Props {
  bets: Bet[];
  initialBankroll: number;
}

/**
 * Financial dashboard: bankroll evolution (equity curve), key ROI metrics and a
 * month-by-month profit breakdown built from the user's settled bets.
 */
export function FinancialDashboard({ bets, initialBankroll }: Props) {
  const stats = useMemo(() => computeStats(bets, initialBankroll), [bets, initialBankroll]);
  const months = useMemo(() => monthlyBreakdown(bets), [bets]);

  const equityData = useMemo(
    () => [
      { index: 0, label: 'Início', bankroll: Math.round(initialBankroll * 100) / 100 },
      ...stats.equity.map((e) => ({
        index: e.index,
        label: e.label,
        bankroll: Math.round((initialBankroll + e.profit) * 100) / 100,
      })),
    ],
    [stats.equity, initialBankroll],
  );

  const hasSettled = stats.wins + stats.losses > 0;
  const profitColor = stats.totalProfit >= 0 ? 'text-success' : 'text-destructive';
  const roiColor = stats.roi >= 0 ? 'text-success' : 'text-destructive';

  return (
    <div className="space-y-3">
      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Banca atual</p>
            <p className="text-xl font-bold">{EUR(stats.bankroll)}</p>
            <p className="text-xs text-muted-foreground">de {EUR(initialBankroll)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lucro líquido</p>
            <p className={`text-xl font-bold ${profitColor}`}>{EUR(stats.totalProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">ROI</p>
            <p className={`text-xl font-bold ${roiColor}`}>{stats.roi}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Taxa de acerto</p>
            <p className="text-xl font-bold">{stats.winrate}%</p>
            <p className="text-xs text-muted-foreground">
              {stats.wins}G / {stats.losses}P
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total apostado</p>
            <p className="text-lg font-bold">{EUR(stats.totalStaked)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Stake máx.</p>
            <p className="text-lg font-bold">{EUR(stats.maxStake)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Maior sequência perdas</p>
            <p className="text-lg font-bold">{stats.maxLossStreak}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-lg font-bold">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bankroll evolution */}
      {hasSettled && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução da banca</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="bankrollFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} unit="€" width={48} />
                <RTooltip
                  formatter={(value) => [EUR((value as number) ?? 0), 'Banca']}
                  labelFormatter={(l) => `Aposta ${l}`}
                />
                <ReferenceLine y={initialBankroll} stroke="#94a3b8" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="bankroll"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#bankrollFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="mt-1 text-xs text-muted-foreground">
              Banca acumulada ao longo das apostas liquidadas. A linha tracejada marca a banca
              inicial ({EUR(initialBankroll)}).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Monthly profit breakdown */}
      {months.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lucro por mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} unit="€" width={48} />
                <RTooltip
                  formatter={(value) => [EUR((value as number) ?? 0), 'Lucro']}
                  labelFormatter={(l) => `Mês ${l}`}
                />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {months.map((m) => (
                    <Cell key={m.month} fill={m.profit >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-1 text-xs text-muted-foreground">
              Resultado líquido por mês (verde = lucro, vermelho = prejuízo).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
