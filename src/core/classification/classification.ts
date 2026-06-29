import type { PredictionTier } from '@/domain/types';

export interface TierMeta {
  tier: PredictionTier;
  label: string;
  /** Tailwind classes for a badge. */
  badgeClass: string;
  minProbability: number;
}

export const TIERS: Record<PredictionTier, TierMeta> = {
  'very-strong': {
    tier: 'very-strong',
    label: 'Muito Forte',
    badgeClass: 'bg-success text-success-foreground',
    minProbability: 0.8,
  },
  strong: {
    tier: 'strong',
    label: 'Forte',
    badgeClass: 'bg-emerald-500/90 text-white',
    minProbability: 0.7,
  },
  medium: {
    tier: 'medium',
    label: 'Média',
    badgeClass: 'bg-warning text-warning-foreground',
    minProbability: 0.6,
  },
  weak: {
    tier: 'weak',
    label: 'Fraca',
    badgeClass: 'bg-muted text-muted-foreground',
    minProbability: 0,
  },
};

export function tierMeta(tier: PredictionTier): TierMeta {
  return TIERS[tier];
}

/**
 * Map a dominant probability (0..1) to its classification tier.
 *
 * Classification is done on the *rounded whole-number percentage* — the same
 * value shown on screen — so the badge never contradicts the displayed % (e.g.
 * a 0.596 prediction shows "60%" and is therefore classified "Média", not the
 * "Fraca" it would be if compared against the raw 0.596).
 */
export function tierForProbability(probability: number): PredictionTier {
  const pct = Math.round(probability * 100);
  if (pct >= 80) return 'very-strong';
  if (pct >= 70) return 'strong';
  if (pct >= 60) return 'medium';
  return 'weak';
}

/** Human label for the dominant BTTS side. */
export function bttsVerdict(probYes: number): { side: 'SIM' | 'NÃO'; probability: number } {
  return probYes >= 0.5
    ? { side: 'SIM', probability: probYes }
    : { side: 'NÃO', probability: 1 - probYes };
}
