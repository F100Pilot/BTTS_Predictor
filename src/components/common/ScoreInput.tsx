import { useState } from 'react';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Compact "home – away" score entry. Calls `onSubmit(homeGoals, awayGoals)` when
 * both are valid non-negative integers and the user confirms (button or Enter).
 * Stops click propagation so it can live inside clickable rows.
 */
export function ScoreInput({
  onSubmit,
  className,
}: {
  onSubmit: (homeGoals: number, awayGoals: number) => void;
  className?: string;
}) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');

  const hg = Number(home);
  const ag = Number(away);
  const valid =
    home !== '' &&
    away !== '' &&
    Number.isInteger(hg) &&
    Number.isInteger(ag) &&
    hg >= 0 &&
    ag >= 0;

  const submit = (): void => {
    if (valid) onSubmit(hg, ag);
  };

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={cn('flex items-center gap-1', className)} onClick={(e) => e.stopPropagation()}>
      <Input
        inputMode="numeric"
        aria-label="Golos da equipa da casa"
        placeholder="–"
        value={home}
        onChange={(e) => setHome(e.target.value.replace(/\D/g, '').slice(0, 2))}
        onKeyDown={onKey}
        className="h-7 w-9 px-1 text-center tabular-nums"
      />
      <span className="text-muted-foreground">–</span>
      <Input
        inputMode="numeric"
        aria-label="Golos da equipa visitante"
        placeholder="–"
        value={away}
        onChange={(e) => setAway(e.target.value.replace(/\D/g, '').slice(0, 2))}
        onKeyDown={onKey}
        className="h-7 w-9 px-1 text-center tabular-nums"
      />
      <Button
        size="icon"
        className="h-7 w-7 shrink-0"
        disabled={!valid}
        onClick={submit}
        aria-label="Confirmar resultado"
        title="Confirmar resultado"
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
