import { describe, it, expect } from 'vitest';
import {
  kellyFraction,
  suggestStake,
  expectedValue,
  compareStrategies,
  type StakeInput,
} from './staking';

const base: StakeInput = {
  bankroll: 100,
  odds: 2,
  probability: 0.6,
  flatStake: 5,
  percent: 25,
  kellyFraction: 1,
};

describe('kellyFraction', () => {
  it('computes the classic fraction for an edge', () => {
    // b=1, p=0.6, q=0.4 → (1*0.6 - 0.4)/1 = 0.2
    expect(kellyFraction(2, 0.6)).toBeCloseTo(0.2, 6);
  });

  it('returns 0 when there is no edge', () => {
    expect(kellyFraction(2, 0.5)).toBe(0);
    expect(kellyFraction(1.5, 0.4)).toBe(0);
  });

  it('returns 0 for non-positive odds margin', () => {
    expect(kellyFraction(1, 0.9)).toBe(0);
  });
});

describe('suggestStake', () => {
  it('flat returns the configured flat stake', () => {
    expect(suggestStake('flat', base)).toBe(5);
  });

  it('percent returns the bankroll percentage', () => {
    expect(suggestStake('percent', base)).toBe(25);
  });

  it('kelly stakes the Kelly fraction of bankroll, capped by percent', () => {
    // full Kelly = 0.2 * 100 = 20, under the 25% cap → 20
    expect(suggestStake('kelly', base)).toBe(20);
    // half Kelly halves it
    expect(suggestStake('kelly', { ...base, kellyFraction: 0.5 })).toBe(10);
  });

  it('caps kelly at the percent brake', () => {
    // Kelly would be 0.2*100=20 but cap at 10% = 10
    expect(suggestStake('kelly', { ...base, percent: 10 })).toBe(10);
  });

  it('never exceeds the bankroll', () => {
    expect(suggestStake('flat', { ...base, flatStake: 500 })).toBe(100);
  });
});

describe('expectedValue', () => {
  it('is positive with an edge and zero at fair odds', () => {
    expect(expectedValue(10, 2, 0.6)).toBeCloseTo(2, 6);
    expect(expectedValue(10, 2, 0.5)).toBeCloseTo(0, 6);
  });
});

describe('compareStrategies', () => {
  it('returns all three strategies with EV', () => {
    const res = compareStrategies(base);
    expect(res.map((r) => r.strategy)).toEqual(['flat', 'percent', 'kelly']);
    expect(res.every((r) => typeof r.ev === 'number')).toBe(true);
  });
});
