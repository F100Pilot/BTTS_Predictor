import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { compareStrategies, kellyFraction, type StakeInput } from '@/core/staking/staking';
import { sanitizeNumber } from '@/services/sanitize';

const EUR = (n: number): string => `€${n.toFixed(2)}`;

/**
 * Side-by-side staking calculator: compares Fixed, %-of-bankroll and Kelly
 * stakes for a given odds + win probability, so the user can pick a strategy
 * other than Martingale. Pure UI over `@/core/staking`.
 */
export function StakeCalculator({ bankroll }: { bankroll: number }) {
  const [odds, setOdds] = useState('1.90');
  const [prob, setProb] = useState('55');
  const [flat, setFlat] = useState('5');
  const [percent, setPercent] = useState('10');
  const [kellyFrac, setKellyFrac] = useState('0.5');

  const input: StakeInput = useMemo(
    () => ({
      bankroll,
      odds: sanitizeNumber(odds, { min: 1, max: 1000, fallback: 1 }),
      probability: sanitizeNumber(prob, { min: 0, max: 100, fallback: 0 }) / 100,
      flatStake: sanitizeNumber(flat, { min: 0, max: 1e9, fallback: 0 }),
      percent: sanitizeNumber(percent, { min: 0, max: 100, fallback: 0 }),
      kellyFraction: sanitizeNumber(kellyFrac, { min: 0, max: 1, fallback: 0 }),
    }),
    [bankroll, odds, prob, flat, percent, kellyFrac],
  );

  const rows = useMemo(() => compareStrategies(input), [input]);
  const edge = useMemo(() => kellyFraction(input.odds, input.probability) > 0, [input]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" /> Calculadora de stake
        </CardTitle>
        <CardDescription>
          Compara estratégias para a mesma aposta. Banca atual: {EUR(bankroll)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="sc-odds">Odd</Label>
            <Input
              id="sc-odds"
              inputMode="decimal"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sc-prob">Probabilidade (%)</Label>
            <Input
              id="sc-prob"
              inputMode="decimal"
              value={prob}
              onChange={(e) => setProb(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sc-flat">Stake fixa (€)</Label>
            <Input
              id="sc-flat"
              inputMode="decimal"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sc-pct">% da banca</Label>
            <Input
              id="sc-pct"
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sc-kelly">Fração Kelly</Label>
            <Input
              id="sc-kelly"
              inputMode="decimal"
              value={kellyFrac}
              onChange={(e) => setKellyFrac(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estratégia</TableHead>
              <TableHead>Stake sugerida</TableHead>
              <TableHead>Valor esperado (EV)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.strategy}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell>{EUR(r.stake)}</TableCell>
                <TableCell
                  className={
                    r.ev > 0
                      ? 'font-semibold text-success'
                      : r.ev < 0
                        ? 'font-semibold text-destructive'
                        : 'text-muted-foreground'
                  }
                >
                  {r.ev >= 0 ? '+' : ''}
                  {EUR(r.ev)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <p className="text-xs text-muted-foreground">
          {edge
            ? 'Há valor (EV positivo): a probabilidade estimada supera a odd. O Kelly aposta proporcional à vantagem, limitado pela % da banca.'
            : 'Sem valor a esta odd/probabilidade — o Kelly sugere €0,00 (não apostar). A stake fixa e a % ignoram o valor.'}
        </p>
      </CardContent>
    </Card>
  );
}
