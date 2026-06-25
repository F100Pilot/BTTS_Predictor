import { describe, it, expect } from 'vitest';
import { brier, evaluate, fitPlatt, applyPlatt, IDENTITY_PLATT, type Sample } from './backtest';

describe('brier', () => {
  it('is squared error of probability vs outcome', () => {
    expect(brier(1, 1)).toBe(0);
    expect(brier(0.5, 1)).toBeCloseTo(0.25, 5);
    expect(brier(0, 1)).toBe(1);
  });
});

describe('evaluate', () => {
  const samples: Sample[] = [
    { probYes: 0.9, tier: 'very-strong', outcome: 1 },
    { probYes: 0.85, tier: 'very-strong', outcome: 1 },
    { probYes: 0.75, tier: 'strong', outcome: 0 },
    { probYes: 0.4, tier: 'weak', outcome: 0 },
  ];

  it('computes overall accuracy and groups by tier', () => {
    const { overall, byTier } = evaluate(samples);
    // correct: 0.9->1, 0.85->1, 0.75->0 (wrong), 0.4->0 (correct) = 3/4
    expect(overall.n).toBe(4);
    expect(overall.accuracy).toBe(75);
    expect(byTier.find((t) => t.tier === 'very-strong')?.n).toBe(2);
    expect(byTier.find((t) => t.tier === 'very-strong')?.accuracy).toBe(100);
    expect(byTier.some((t) => t.tier === 'medium')).toBe(false); // no medium samples
  });
});

describe('fitPlatt / applyPlatt', () => {
  it('returns identity for too few samples', () => {
    expect(fitPlatt([{ probYes: 0.6, outcome: 1 }])).toEqual(IDENTITY_PLATT);
  });

  it('learns to correct an over-confident model', () => {
    // Model says 0.9 but the real rate is ~50% — recalibration should pull it down.
    const samples = Array.from({ length: 40 }, (_, i) => ({
      probYes: 0.9,
      outcome: (i % 2) as 0 | 1,
    }));
    const params = fitPlatt(samples);
    const recal = applyPlatt(0.9, params);
    expect(recal).toBeLessThan(0.9);
    expect(recal).toBeGreaterThan(0.35);
    expect(recal).toBeLessThan(0.65);
  });

  it('identity mapping leaves probabilities unchanged', () => {
    expect(applyPlatt(0.73, IDENTITY_PLATT)).toBeCloseTo(0.73, 5);
  });
});
