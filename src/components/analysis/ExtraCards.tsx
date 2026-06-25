import type { BttsPrediction, Fixture, MarketPrediction } from '@/domain/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { computeValue } from '@/core/value/value';
import { toPercent, round } from '@/lib/math';

export function MarketsCard({ markets, fixture }: { markets: MarketPrediction; fixture: Fixture }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Over 2.5 golos', value: toPercent(markets.over25) },
    { label: 'Under 2.5 golos', value: toPercent(markets.under25) },
    { label: `Vitória ${fixture.home.name}`, value: toPercent(markets.homeWin) },
    { label: 'Empate', value: toPercent(markets.draw) },
    { label: `Vitória ${fixture.away.name}`, value: toPercent(markets.awayWin) },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Outros mercados</CardTitle>
        <CardDescription>
          Modelo de Poisson · golos esperados {round(markets.lambdaHome, 2)} –{' '}
          {round(markets.lambdaAway, 2)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ValueCard({
  prediction,
  fixture,
}: {
  prediction: BttsPrediction;
  fixture: Fixture;
}) {
  const value = computeValue(prediction.probYes, fixture.odds);
  if (!value.yes && !value.no) return null;

  const Row = ({ side, label }: { side: 'yes' | 'no'; label: string }) => {
    const v = value[side];
    if (!v) return null;
    const positive = v.edge > 0;
    const isBest = value.best === side;
    return (
      <div className="flex items-center justify-between border-b py-2 last:border-0">
        <span className="font-medium">
          {label} <span className="text-xs text-muted-foreground">@ {v.odd.toFixed(2)}</span>
        </span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">modelo {toPercent(v.prob)}</span>
          <span className={positive ? 'font-bold text-success' : 'text-muted-foreground'}>
            {positive ? '+' : ''}
            {round(v.edge * 100, 1)}%
          </span>
          {isBest && positive && (
            <span className="rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground">
              valor
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Valor vs mercado</CardTitle>
        <CardDescription>
          Edge = probabilidade do modelo × odd − 1. Positivo (verde) = valor esperado a favor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Row side="yes" label="BTTS SIM" />
        <Row side="no" label="BTTS NÃO" />
      </CardContent>
    </Card>
  );
}
