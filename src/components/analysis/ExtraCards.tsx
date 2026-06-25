import { useState } from 'react';
import type { BttsPrediction, Fixture, MarketPrediction } from '@/domain/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  // Source odds as defaults; the user can type their bookmaker's odds (the free
  // Football-Data.org plan does not provide odds, so the card is always usable).
  const [yesOdd, setYesOdd] = useState(fixture.odds?.bttsYes ? String(fixture.odds.bttsYes) : '');
  const [noOdd, setNoOdd] = useState(fixture.odds?.bttsNo ? String(fixture.odds.bttsNo) : '');

  const odds = {
    bttsYes: Number(yesOdd) > 1 ? Number(yesOdd) : undefined,
    bttsNo: Number(noOdd) > 1 ? Number(noOdd) : undefined,
  };
  const value = computeValue(prediction.probYes, odds);

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
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="odd-yes" className="text-xs">
              Odd BTTS SIM
            </Label>
            <Input
              id="odd-yes"
              type="number"
              step="0.01"
              min={1.01}
              placeholder="ex.: 1.90"
              value={yesOdd}
              onChange={(e) => setYesOdd(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="odd-no" className="text-xs">
              Odd BTTS NÃO
            </Label>
            <Input
              id="odd-no"
              type="number"
              step="0.01"
              min={1.01}
              placeholder="ex.: 1.90"
              value={noOdd}
              onChange={(e) => setNoOdd(e.target.value)}
            />
          </div>
        </div>
        {!value.yes && !value.no ? (
          <p className="text-sm text-muted-foreground">
            Introduza as odds da sua casa de apostas para calcular o valor.
          </p>
        ) : (
          <div>
            <Row side="yes" label="BTTS SIM" />
            <Row side="no" label="BTTS NÃO" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
