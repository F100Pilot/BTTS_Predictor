import { clamp, round } from '@/lib/math';
import { DEFAULT_WEIGHTS, normalizeWeights, type FactorKey } from '@/core/prediction/weights';

export interface TuneSample {
  scores: Record<FactorKey, number>;
  outcome: 0 | 1;
}

export interface TuneResult {
  weights: Record<FactorKey, number>;
  brierBefore: number;
  brierAfter: number;
  n: number;
}

const KEYS = Object.keys(DEFAULT_WEIGHTS) as FactorKey[];

function predictProb(scores: Record<FactorKey, number>, w: Record<FactorKey, number>): number {
  let p = 0;
  for (const k of KEYS) p += (w[k] ?? 0) * (scores[k] ?? 0.5);
  return clamp(p);
}

function brierOf(samples: TuneSample[], w: Record<FactorKey, number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += (predictProb(s.scores, w) - s.outcome) ** 2;
  return sum / samples.length;
}

/**
 * Coordinate-descent search for the factor weights that minimise the Brier
 * score over settled predictions (whose per-factor scores were recorded).
 * Deterministic; weights are kept normalised (sum = 1).
 */
export function tuneWeights(samples: TuneSample[], current: Record<FactorKey, number>): TuneResult {
  let best = normalizeWeights(current);
  const brierBefore = brierOf(samples, best);
  let bestBrier = brierBefore;

  for (const step of [0.1, 0.05, 0.02]) {
    let improved = true;
    let guard = 0;
    while (improved && guard < 300) {
      improved = false;
      guard += 1;
      for (const k of KEYS) {
        for (const dir of [1, -1]) {
          const candidate = { ...best, [k]: Math.max(0, best[k] + dir * step) };
          const norm = normalizeWeights(candidate);
          const b = brierOf(samples, norm);
          if (b < bestBrier - 1e-9) {
            best = norm;
            bestBrier = b;
            improved = true;
          }
        }
      }
    }
  }

  const rounded = {} as Record<FactorKey, number>;
  for (const k of KEYS) rounded[k] = round(best[k], 3);
  return {
    weights: normalizeWeights(rounded),
    brierBefore: round(brierBefore, 4),
    brierAfter: round(bestBrier, 4),
    n: samples.length,
  };
}
