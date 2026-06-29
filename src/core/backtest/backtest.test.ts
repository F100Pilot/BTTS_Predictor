import { describe, it, expect } from 'vitest';
import {
  brier,
  evaluate,
  fitPlatt,
  applyPlatt,
  reliabilityCurve,
  accuracyByConfidence,
  IDENTITY_PLATT,
  type Sample,
} from './backtest';

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

describe('reliabilityCurve', () => {
  it('buckets predictions and compares predicted vs observed', () => {
    const samples: Sample[] = [
      { probYes: 0.05, tier: 'weak', outcome: 0 },
      { probYes: 0.15, tier: 'weak', outcome: 0 },
      { probYes: 0.85, tier: 'very-strong', outcome: 1 },
      { probYes: 0.95, tier: 'very-strong', outcome: 1 },
    ];
    const curve = reliabilityCurve(samples, 5);
    expect(curve).toHaveLength(5);
    expect(curve[0]!.n).toBe(2); // 0-20% bucket
    expect(curve[0]!.actual).toBe(0);
    expect(curve[4]!.n).toBe(2); // 80-100% bucket
    expect(curve[4]!.actual).toBe(100);
    expect(curve[2]!.actual).toBeNull(); // empty middle bucket
  });
});

describe('accuracyByConfidence', () => {
  it('groups hit-rate by the shown (dominant) percentage band', () => {
    const samples: Sample[] = [
      // 90–100% band: both correct (one YES side, one NO side)
      { probYes: 0.95, tier: 'very-strong', outcome: 1 },
      { probYes: 0.05, tier: 'very-strong', outcome: 0 },
      // 70–80% band: one correct, one wrong → 50%
      { probYes: 0.75, tier: 'strong', outcome: 1 },
      { probYes: 0.25, tier: 'strong', outcome: 1 },
    ];
    const bands = accuracyByConfidence(samples, 10);
    expect(bands).toHaveLength(5); // 50-60,60-70,70-80,80-90,90-100
    const top = bands.find((b) => b.lower === 90);
    expect(top?.n).toBe(2);
    expect(top?.accuracy).toBe(100);
    const mid = bands.find((b) => b.lower === 70);
    expect(mid?.n).toBe(2);
    expect(mid?.accuracy).toBe(50);
    const empty = bands.find((b) => b.lower === 50);
    expect(empty?.n).toBe(0);
    expect(empty?.accuracy).toBeNull();
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
