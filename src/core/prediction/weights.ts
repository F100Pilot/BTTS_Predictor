import type { PredictionFactor } from '@/domain/types';

export type FactorKey = PredictionFactor['key'];

/** Default factor weights as specified by the product requirements. Sum = 1. */
export const DEFAULT_WEIGHTS: Record<FactorKey, number> = {
  form: 0.3,
  bttsHistory: 0.25,
  attack: 0.15,
  defense: 0.15,
  h2h: 0.1,
  venue: 0.05,
};

export const FACTOR_LABELS: Record<FactorKey, string> = {
  form: 'Forma recente',
  bttsHistory: 'BTTS histórico',
  attack: 'Ataque',
  defense: 'Defesa',
  h2h: 'Head-to-head',
  venue: 'Fator casa/fora',
};

/** Normalize an arbitrary weight map so the values sum to 1 (defensive). */
export function normalizeWeights(weights: Record<FactorKey, number>): Record<FactorKey, number> {
  const total = Object.values(weights).reduce((s, w) => s + (w > 0 ? w : 0), 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  const out = {} as Record<FactorKey, number>;
  (Object.keys(weights) as FactorKey[]).forEach((k) => {
    out[k] = Math.max(0, weights[k]) / total;
  });
  return out;
}
