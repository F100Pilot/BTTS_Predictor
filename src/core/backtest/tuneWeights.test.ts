import { describe, it, expect } from 'vitest';
import { tuneWeights, type TuneSample } from './tuneWeights';
import { DEFAULT_WEIGHTS, type FactorKey } from '@/core/prediction/weights';

function scores(partial: Partial<Record<FactorKey, number>>): Record<FactorKey, number> {
  return {
    form: 0.5,
    bttsHistory: 0.5,
    attack: 0.5,
    defense: 0.5,
    h2h: 0.5,
    venue: 0.5,
    ...partial,
  };
}

describe('tuneWeights', () => {
  it('keeps weights normalised and does not worsen the Brier score', () => {
    const samples: TuneSample[] = [
      { scores: scores({ form: 0.9 }), outcome: 1 },
      { scores: scores({ form: 0.1 }), outcome: 0 },
      { scores: scores({ form: 0.8 }), outcome: 1 },
      { scores: scores({ form: 0.2 }), outcome: 0 },
    ];
    const res = tuneWeights(samples, DEFAULT_WEIGHTS);
    const sum = Object.values(res.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(res.brierAfter).toBeLessThanOrEqual(res.brierBefore + 1e-9);
  });

  it('shifts weight toward the factor that predicts the outcome', () => {
    // "form" perfectly separates outcomes; "venue" is noise.
    const samples: TuneSample[] = Array.from({ length: 20 }, (_, i) => ({
      scores: scores({ form: i % 2 === 0 ? 0.95 : 0.05, venue: 0.5 }),
      outcome: (i % 2 === 0 ? 1 : 0) as 0 | 1,
    }));
    const res = tuneWeights(samples, DEFAULT_WEIGHTS);
    expect(res.weights.form).toBeGreaterThan(res.weights.venue);
    expect(res.brierAfter).toBeLessThan(res.brierBefore);
  });
});
