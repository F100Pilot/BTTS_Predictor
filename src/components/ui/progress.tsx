import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value (0..max). */
  value: number;
  /** Maximum value. Defaults to 100. */
  max?: number;
  /** Optional Tailwind class for the filled portion (e.g. 'bg-success'). */
  indicatorClassName?: string;
}

/**
 * Minimal determinate progress bar — no external deps. Renders an accessible
 * track + filled indicator whose width reflects value/max.
 */
function Progress({ value, max = 100, className, indicatorClassName, ...props }: ProgressProps) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(safeMax, Math.max(0, value))}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-all duration-300',
          indicatorClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
