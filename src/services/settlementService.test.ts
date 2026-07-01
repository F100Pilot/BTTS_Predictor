import { describe, it, expect } from 'vitest';
import type { Bet } from '@/domain/types';
import { bttsFromGoals, settleBetAgainstGoals } from './settlementService';

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

describe('settleBetAgainstGoals — finished games', () => {
  it('grades BTTS bets (absent marketKey ⇒ legacy BTTS)', () => {
    expect(settleBetAgainstGoals(bet({ selection: 'SIM' }), 1, 1)).toBe('won');
    expect(settleBetAgainstGoals(bet({ selection: 'SIM' }), 2, 0)).toBe('lost');
    expect(settleBetAgainstGoals(bet({ selection: 'NÃO' }), 0, 0)).toBe('won');
    expect(settleBetAgainstGoals(bet({ selection: 'NÃO' }), 1, 2)).toBe('lost');
  });

  it('handles english yes/no selections', () => {
    expect(settleBetAgainstGoals(bet({ selection: 'Yes' }), 1, 1)).toBe('won');
    expect(settleBetAgainstGoals(bet({ selection: 'No' }), 1, 1)).toBe('lost');
  });

  it('grades Over/Under 2.5 bets', () => {
    const ou = (selection: string): Bet => bet({ marketKey: 'ou25', selection });
    expect(settleBetAgainstGoals(ou('Over 2.5'), 2, 1)).toBe('won');
    expect(settleBetAgainstGoals(ou('Over 2.5'), 1, 1)).toBe('lost');
    expect(settleBetAgainstGoals(ou('Under 2.5'), 1, 0)).toBe('won');
    expect(settleBetAgainstGoals(ou('Under 2.5'), 2, 2)).toBe('lost');
  });

  it('grades 1X2 bets', () => {
    const x12 = (selection: string): Bet => bet({ marketKey: 'x12', selection });
    expect(settleBetAgainstGoals(x12('Casa'), 2, 1)).toBe('won');
    expect(settleBetAgainstGoals(x12('Casa'), 1, 1)).toBe('lost');
    expect(settleBetAgainstGoals(x12('Empate'), 1, 1)).toBe('won');
    expect(settleBetAgainstGoals(x12('Fora'), 0, 1)).toBe('won');
    expect(settleBetAgainstGoals(x12('Fora'), 1, 0)).toBe('lost');
  });

  it('returns null for ambiguous selections', () => {
    expect(settleBetAgainstGoals(bet({ selection: 'Over' }), 1, 1)).toBeNull();
    expect(settleBetAgainstGoals(bet({ marketKey: 'ou25', selection: '???' }), 3, 0)).toBeNull();
  });
});

describe('settleBetAgainstGoals — in play (finished: false)', () => {
  const live = { finished: false };

  it('locks BTTS once both teams have scored', () => {
    expect(settleBetAgainstGoals(bet({ selection: 'SIM' }), 1, 1, live)).toBe('won');
    expect(settleBetAgainstGoals(bet({ selection: 'NÃO' }), 1, 1, live)).toBe('lost');
  });

  it('waits while BTTS is still open', () => {
    expect(settleBetAgainstGoals(bet({ selection: 'SIM' }), 1, 0, live)).toBeNull();
    expect(settleBetAgainstGoals(bet({ selection: 'NÃO' }), 0, 0, live)).toBeNull();
  });

  it('locks Over/Under 2.5 once the total passes it', () => {
    const ou = (selection: string): Bet => bet({ marketKey: 'ou25', selection });
    expect(settleBetAgainstGoals(ou('Over 2.5'), 3, 0, live)).toBe('won');
    expect(settleBetAgainstGoals(ou('Under 2.5'), 2, 1, live)).toBe('lost');
    expect(settleBetAgainstGoals(ou('Over 2.5'), 2, 0, live)).toBeNull();
    expect(settleBetAgainstGoals(ou('Under 2.5'), 1, 1, live)).toBeNull();
  });

  it('never settles 1X2 before full time', () => {
    expect(settleBetAgainstGoals(bet({ marketKey: 'x12', selection: 'Casa' }), 5, 0, live)).toBe(
      null,
    );
  });
});
