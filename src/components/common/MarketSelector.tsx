import { MARKETS, type MarketKey } from '@/core/markets/markets';
import { cn } from '@/lib/utils';

/** Segmented control to pick the active betting market (BTTS / O/U 2.5 / 1X2). */
export function MarketSelector({
  value,
  onChange,
  className,
}: {
  value: MarketKey;
  onChange: (market: MarketKey) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Mercado"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1',
        className,
      )}
    >
      {MARKETS.map((m) => {
        const active = m.key === value;
        return (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            title={m.label}
          >
            {m.short}
          </button>
        );
      })}
    </div>
  );
}
