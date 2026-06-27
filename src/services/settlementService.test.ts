import { describe, it, expect } from 'vitest';
import type { Bet } from '@/domain/types';
import { bttsFromGoals, settleBetAgainstBtts } from './settlementService';

const bet = (over: Partial<Bet>): Bet => ({
  id: 'b1',
  createdAt: 0,
  matchLabel: 'A vs B',
  market: 'BTTS',
  selection: 'SIM',
  odds: 1.8,
  stake: 10,
  step: 0,
  result: 'pending',
  ...over,
});

describe('bttsFromGoals', () => {
  it('is yes only when both teams scored', () => {
    expect(bttsFromGoals(1, 1)).toBe('yes');
    expect(bttsFromGoals(3, 2)).toBe('yes');
    expect(bttsFromGoals(0, 0)).toBe('no');
    expect(bttsFromGoals(2, 0)).toBe('no');
    expect(bttsFromGoals(0, 3)).toBe('no');
  });
});

describe('settleBetAgainstBtts', () => {
  it('grades a SIM bet', () => {
    expect(settleBetAgainstBtts(bet({ selection: 'SIM' }), 'yes')).toBe('won');
    expect(settleBetAgainstBtts(bet({ selection: 'SIM' }), 'no')).toBe('lost');
  });
  it('grades a NÃO bet', () => {
    expect(settleBetAgainstBtts(bet({ selection: 'NÃO' }), 'no')).toBe('won');
    expect(settleBetAgainstBtts(bet({ selection: 'NÃO' }), 'yes')).toBe('lost');
  });
  it('handles english yes/no selections', () => {
    expect(settleBetAgainstBtts(bet({ selection: 'Yes' }), 'yes')).toBe('won');
    expect(settleBetAgainstBtts(bet({ selection: 'No' }), 'yes')).toBe('lost');
  });
  it('returns null for ungradable selections', () => {
    expect(settleBetAgainstBtts(bet({ market: 'Over 2.5', selection: 'Over' }), 'yes')).toBeNull();
    expect(settleBetAgainstBtts(bet({ market: '1X2', selection: 'Casa' }), 'no')).toBeNull();
  });
});
