import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  confidenceBandsOutcomes,
  evaluateOutcomes,
  reliabilityOutcomes,
  type OutcomeSample,
} from '@/core/backtest/backtest';
import { EmptyState } from '@/components/common/States';

const accuracyColor = (acc: number): string =>
  acc >= 70 ? '#10b981' : acc >= 55 ? '#f59e0b' : '#ef4444';

/**
 * Per-market performance: accuracy / Brier, a hit-rate-by-band bar chart and a
 * calibration curve (predicted pick % vs observed hit-rate). Drives Over/Under
 * and 1X2 in the History tab, kept separate from the BTTS-specific view.
 */
export function MarketPerformance({ samples, label }: { samples: OutcomeSample[]; label: string }) {
  const summary = useMemo(() => evaluateOutcomes(samples), [samples]);
  const bands = useMemo(
    () => confidenceBandsOutcomes(samples, 10).filter((b) => b.n > 0),
    [samples],
  );
  const reliability = useMemo(
    () =>
      reliabilityOutcomes(samples, 5).map((b) => ({
        predicted: b.predicted,
        actual: b.actual,
        ideal: b.predicted,
        n: b.n,
      })),
    [samples],
  );

  if (samples.length === 0) {
    return (
      <EmptyState
        title={`Sem dados para ${label}`}
        description="Marca o resultado (score) de alguns jogos que tenham este mercado calculado, para veres o acerto."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="text-xs text-muted-foreground">Acerto</span>
          <p className="text-lg font-bold">{summary.accuracy}%</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Brier (↓ melhor)</span>
          <p className="text-lg font-bold">{summary.brier}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Jogos</span>
          <p className="text-lg font-bold">{summary.n}</p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Acerto por faixa de probabilidade
        </p>
        <ResponsiveContainer width="100%" height={Math.max(140, bands.length * 44)}>
          <BarChart
            layout="vertical"
            data={bands}
            margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
            <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} />
            <YAxis type="category" dataKey="label" width={56} fontSize={11} tickLine={false} />
            <RTooltip
              formatter={(v: number, _n, p) => [
                `${v}% acerto · ${p?.payload?.n ?? 0} jogo(s)`,
                'Faixa',
              ]}
            />
            <Bar
              dataKey="accuracy"
              radius={[0, 4, 4, 0]}
              label={{ position: 'right', formatter: (v: number) => `${v}%`, fontSize: 11 }}
            >
              {bands.map((b) => (
                <Cell key={b.label} fill={accuracyColor(b.accuracy ?? 0)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Curva de fiabilidade (previsto vs acerto real)
        </p>
        <ResponsiveContainer width="100%" height={200}>
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
              formatter={(value, name, item) => {
                const v = value as number | null;
                if (name === 'actual') {
                  const n = (item?.payload?.n as number) ?? 0;
                  return [v == null ? '—' : `${v}% · ${n} jogo(s)`, 'Acerto'];
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
              name="Acerto"
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
        Mostra o acerto do mercado {label}, agrupado pela percentagem do prognóstico. Só conta jogos
        com resultado (score) introduzido. O número junto a cada ponto é o nº de jogos da faixa.
      </p>
    </div>
  );
}
