import type { BttsPrediction } from '@/domain/types';
import { tierMeta, bttsVerdict } from '@/core/classification/classification';
import { toPercent } from '@/lib/math';
import { cn } from '@/lib/utils';

export function TierBadge({ tier }: { tier: BttsPrediction['tier'] }) {
  const meta = tierMeta(tier);
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
        meta.badgeClass,
      )}
    >
      {meta.label}
    </span>
  );
}

export function ProbabilityBar({ probYes }: { probYes: number }) {
  const pct = Math.round(probYes * 100);
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>SIM {pct}%</span>
        <span>NÃO {100 - pct}%</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        <div className="h-full bg-destructive/70" style={{ width: `${100 - pct}%` }} />
      </div>
    </div>
  );
}

export function ConfidenceMeter({ confidence }: { confidence: number }) {
  const filled = Math.round(confidence);
  return (
    <div className="flex items-center gap-1" title={`Confiança ${confidence}/10`}>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className={cn('h-2 w-2 rounded-full', i < filled ? 'bg-primary' : 'bg-muted')}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-muted-foreground">{confidence}/10</span>
    </div>
  );
}

export function VerdictPill({ prediction }: { prediction: BttsPrediction }) {
  const verdict = bttsVerdict(prediction.probYes);
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold">BTTS {verdict.side}</span>
      <span className="text-lg font-semibold text-primary">{toPercent(verdict.probability)}</span>
    </div>
  );
}
