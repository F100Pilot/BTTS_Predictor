import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, ExternalLink, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMartingale } from '@/store/martingaleStore';
import { activeSeries } from '@/core/martingale/martingale';

const EUR = (n: number): string => `€${n.toFixed(2)}`;

export interface MartingaleGame {
  matchLabel: string;
  fixtureId?: string;
  kickoff?: string;
  oddsYes?: number;
  oddsNo?: number;
  defaultSelection?: 'SIM' | 'NÃO';
}

/**
 * Per-game Martingale pop-up: pick the BTTS side + odd, see the suggested stake
 * for the current series step, and add the bet — without leaving the match.
 */
export function MartingaleDialog({
  open,
  onOpenChange,
  game,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: MartingaleGame;
}) {
  const navigate = useNavigate();
  const bets = useMartingale((s) => s.bets);
  const loaded = useMartingale((s) => s.loaded);
  const seriesResetAt = useMartingale((s) => s.seriesResetAt);
  const baseProfit = useMartingale((s) => s.baseProfit);
  const initialBankroll = useMartingale((s) => s.initialBankroll);
  const maxStep = useMartingale((s) => s.maxStep);
  const nextStake = useMartingale((s) => s.nextStake);
  const addBet = useMartingale((s) => s.addBet);
  const refresh = useMartingale((s) => s.refresh);

  // Bets live in IndexedDB (not persisted by zustand) — make sure they're
  // loaded the first time this pop-up is opened, so the active series step and
  // accumulated loss are correct even if the Martingale page was never visited.
  useEffect(() => {
    if (open && !loaded) void refresh();
  }, [open, loaded, refresh]);

  const [selection, setSelection] = useState<'SIM' | 'NÃO'>(game.defaultSelection ?? 'SIM');
  const defaultOdd = (selection === 'SIM' ? game.oddsYes : game.oddsNo) ?? undefined;
  const [odds, setOdds] = useState(defaultOdd ? defaultOdd.toFixed(2) : '');
  const [added, setAdded] = useState(false);

  const oddsVal = Number(odds);
  const series = useMemo(() => activeSeries(bets, seriesResetAt), [bets, seriesResetAt]);
  const stake = oddsVal > 1 ? nextStake(oddsVal) : 0;
  const stepBlocked = maxStep > 0 && series.step > maxStep;
  const canAdd = oddsVal > 1 && !stepBlocked && !added;

  const pickSide = (side: 'SIM' | 'NÃO'): void => {
    setSelection(side);
    const o = side === 'SIM' ? game.oddsYes : game.oddsNo;
    if (o) setOdds(o.toFixed(2));
  };

  const handleAdd = (): void => {
    if (!canAdd) return;
    void addBet({
      matchLabel: game.matchLabel,
      market: 'BTTS',
      selection,
      odds: oddsVal,
      fixtureId: game.fixtureId,
      kickoff: game.kickoff,
    }).then(() => setAdded(true));
  };

  const openFull = (): void => {
    onOpenChange(false);
    navigate('/martingale', {
      state: {
        matchLabel: game.matchLabel,
        selection,
        odds: oddsVal > 1 ? oddsVal : undefined,
        fixtureId: game.fixtureId,
        kickoff: game.kickoff,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Martingale
          </DialogTitle>
          <DialogDescription className="truncate">{game.matchLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Seleção BTTS</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['SIM', 'NÃO'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => pickSide(side)}
                  className={
                    'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ' +
                    (selection === side
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent')
                  }
                >
                  BTTS {side}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mg-odd">Odd</Label>
              <Input
                id="mg-odd"
                inputMode="decimal"
                placeholder="ex.: 1.90"
                value={odds}
                onChange={(e) => {
                  setOdds(e.target.value);
                  setAdded(false);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stake sugerida</Label>
              <div className="flex h-10 items-center rounded-md border border-primary/40 bg-primary/10 px-3 font-bold tabular-nums text-primary">
                {oddsVal > 1 ? EUR(stake) : '—'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Série: <span className="font-semibold text-foreground">step {series.step}</span>
            </span>
            <span>
              Perda acum.{' '}
              <span className="font-semibold text-foreground">{EUR(series.currentLoss)}</span>
            </span>
            <span>
              Banca <span className="font-semibold text-foreground">{EUR(initialBankroll)}</span>
            </span>
          </div>

          {stepBlocked && (
            <p className="text-xs text-destructive">
              Step máximo ({maxStep}) atingido — novas apostas estão bloqueadas (ver Definições do
              Martingale).
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            A stake é calculada para que uma vitória recupere a série e garanta o lucro base (
            {EUR(baseProfit)}).
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={openFull}>
              <ExternalLink className="h-4 w-4" /> Abrir Martingale completo
            </Button>
            <Button size="sm" disabled={!canAdd} onClick={handleAdd}>
              {added ? (
                <>
                  <Check className="h-4 w-4" /> Aposta adicionada
                </>
              ) : (
                'Adicionar aposta'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
