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

/** Map a dominant probability (0..1) to its classification tier. */
export function tierForProbability(probability: number): PredictionTier {
  if (probability >= 0.8) return 'very-strong';
  if (probability >= 0.7) return 'strong';
  if (probability >= 0.6) return 'medium';
  return 'weak';
}

/** Human label for the dominant BTTS side. */
export function bttsVerdict(probYes: number): { side: 'SIM' | 'NÃO'; probability: number } {
  return probYes >= 0.5
    ? { side: 'SIM', probability: probYes }
    : { side: 'NÃO', probability: 1 - probYes };
}
