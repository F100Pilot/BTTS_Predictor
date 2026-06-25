import { describe, it, expect } from 'vitest';
import { impliedBttsYes, calibrate } from './calibration';
import type { BttsPrediction } from '@/domain/types';

const base: BttsPrediction = {
  probYes: 0.6,
  probNo: 0.4,
  confidence: 5,
  tier: 'medium',
  factors: [],
  modelProbYes: 0.6,
};

describe('impliedBttsYes', () => {
  it('de-vigs two-sided odds', () => {
    // 1/2 = .5, 1/2 = .5 -> .5
    expect(impliedBttsYes(2, 2)).toBeCloseTo(0.5, 5);
    // 1/1.5=.667, 1/3=.333 -> .667
    expect(impliedBttsYes(1.5, 3)).toBeCloseTo(0.6667, 3);
  });

  it('falls back to raw implied with a single side', () => {
    expect(impliedBttsYes(2)).toBeCloseTo(0.5, 5);
    expect(impliedBttsYes(undefined, 2)).toBeCloseTo(0.5, 5);
  });

  it('returns null without usable odds', () => {
    expect(impliedBttsYes()).toBeNull();
    expect(impliedBttsYes(1, 1)).toBeNull();
  });
});

describe('calibrate', () => {
  it('returns the model unchanged when lambda is 0 or no odds', () => {
    expect(calibrate(base, 0.9, 0)).toBe(base);
    expect(calibrate(base, null, 0.5)).toBe(base);
  });

  it('blends model and market by lambda', () => {
    const out = calibrate(base, 0.8, 0.5); // 0.5*0.6 + 0.5*0.8 = 0.7
    expect(out.probYes).toBeCloseTo(0.7, 5);
    expect(out.probNo).toBeCloseTo(0.3, 5);
    expect(out.tier).toBe('strong'); // dominant 0.7
    expect(out.marketImpliedYes).toBe(0.8);
    expect(out.calibrationApplied).toBe(0.5);
    expect(out.modelProbYes).toBe(0.6);
  });
});
