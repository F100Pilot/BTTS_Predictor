import { describe, it, expect } from 'vitest';
import {
  calculateStake,
  winProfit,
  activeSeries,
  globalSeries,
  computeStats,
  projectSeries,
  betsForMarket,
} from './martingale';
import type { Bet } from '@/domain/types';

function bet(partial: Partial<Bet>): Bet {
  return {
    id: partial.id ?? 'b',
    createdAt: partial.createdAt ?? 1,
    settledAt: partial.settledAt,
    matchLabel: 'A vs B',
    market: 'BTTS',
    marketKey: partial.marketKey,
    selection: 'SIM',
    odds: partial.odds ?? 2,
    stake: partial.stake ?? 10,
    step: partial.step ?? 1,
    result: partial.result ?? 'pending',
  };
}

describe('betsForMarket', () => {
  it('groups bets by market key (absent ⇒ btts) — used only as a table filter', () => {
    const all = [
      bet({ id: 'a', marketKey: 'btts' }),
      bet({ id: 'b' }), // legacy, no key ⇒ btts
      bet({ id: 'c', marketKey: 'ou25' }),
      bet({ id: 'd', marketKey: 'x12' }),
    ];
    expect(betsForMarket(all, 'btts').map((b) => b.id)).toEqual(['a', 'b']);
    expect(betsForMarket(all, 'ou25').map((b) => b.id)).toEqual(['c']);
    expect(betsForMarket(all, 'x12').map((b) => b.id)).toEqual(['d']);
  });
});

describe('globalSeries', () => {
  it('shares the accumulated loss across markets — a BTTS loss carries into O/U', () => {
    const bets = [
      bet({ id: '1', createdAt: 1, settledAt: 1, result: 'lost', stake: 10, marketKey: 'btts' }),
      bet({ id: '2', createdAt: 2, settledAt: 2, result: 'lost', stake: 20, marketKey: 'ou25' }),
    ];
    // Both losses count regardless of market: 10 + 20 = 30, next step is 3.
    expect(globalSeries(bets)).toEqual({ currentLoss: 30, step: 3 });
  });

  it('a win in any market recovers the whole shared pool', () => {
    const bets = [
      bet({ id: '1', createdAt: 1, settledAt: 1, result: 'lost', stake: 10, marketKey: 'btts' }),
      bet({ id: '2', createdAt: 2, settledAt: 2, result: 'won', stake: 20, marketKey: 'x12' }),
    ];
    expect(globalSeries(bets)).toEqual({ currentLoss: 0, step: 1 });
  });
});

describe('calculateStake', () => {
  it('recovers accumulated loss plus base profit at the given odds', () => {
    // (50 + 20) / (2.5 - 1) = 46.67
    expect(calculateStake(50, 20, 2.5)).toBeCloseTo(46.67, 2);
  });

  it('equals baseProfit/(odds-1) on a fresh series', () => {
    expect(calculateStake(0, 10, 2)).toBe(10);
  });

  it('returns 0 for non-positive margins', () => {
    expect(calculateStake(50, 20, 1)).toBe(0);
    expect(calculateStake(50, 20, 0.5)).toBe(0);
  });
});

describe('winProfit', () => {
  it('is stake * (odds - 1)', () => {
    expect(winProfit(10, 2)).toBe(10);
    expect(winProfit(46.67, 2.5)).toBe(70.01); // 46.67 * 1.5 = 70.005, rounded to 2dp
  });
});

describe('activeSeries', () => {
  it('accumulates consecutive losses and resets on a win', () => {
    const bets = [
      bet({ id: '1', createdAt: 1, settledAt: 1, result: 'lost', stake: 10 }),
      bet({ id: '2', createdAt: 2, settledAt: 2, result: 'lost', stake: 20 }),
    ];
    expect(activeSeries(bets)).toEqual({ currentLoss: 30, step: 3 });

    bets.push(bet({ id: '3', createdAt: 3, settledAt: 3, result: 'won', stake: 30 }));
    expect(activeSeries(bets)).toEqual({ currentLoss: 0, step: 1 });
  });

  it('ignores bets on/before the series reset timestamp', () => {
    const bets = [
      bet({ id: '1', createdAt: 1, settledAt: 1, result: 'lost', stake: 10 }),
      bet({ id: '2', createdAt: 5, settledAt: 5, result: 'lost', stake: 20 }),
    ];
    expect(activeSeries(bets, 3)).toEqual({ currentLoss: 20, step: 2 });
  });
});

describe('projectSeries', () => {
  it('grows the stake as losses accumulate at fixed odds', () => {
    const proj = projectSeries(0, 10, 2, 1, 3);
    // step1: stake 10 -> loss 10; step2: (10+10)/1 = 20 -> loss 30; step3: (30+10)/1 = 40 -> 70
    expect(proj).toEqual([
      { step: 1, stake: 10, cumulativeLoss: 10 },
      { step: 2, stake: 20, cumulativeLoss: 30 },
      { step: 3, stake: 40, cumulativeLoss: 70 },
    ]);
  });

  it('starts from the provided accumulated loss and step', () => {
    const proj = projectSeries(30, 10, 2, 3, 1);
    expect(proj[0]).toEqual({ step: 3, stake: 40, cumulativeLoss: 70 });
  });
});

describe('computeStats', () => {
  it('computes bankroll, profit, ROI and streaks', () => {
    const bets = [
      bet({ id: '1', createdAt: 1, settledAt: 1, result: 'lost', stake: 10, odds: 2 }),
      bet({ id: '2', createdAt: 2, settledAt: 2, result: 'lost', stake: 20, odds: 2 }),
      bet({ id: '3', createdAt: 3, settledAt: 3, result: 'won', stake: 40, odds: 2 }),
      bet({ id: '4', createdAt: 4, result: 'pending', stake: 10, odds: 2 }),
    ];
    const stats = computeStats(bets, 100);
    // profit = -10 -20 +40 = +10
    expect(stats.totalProfit).toBe(10);
    expect(stats.bankroll).toBe(110);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(2);
    expect(stats.pending).toBe(1);
    expect(stats.maxLossStreak).toBe(2);
    expect(stats.maxStake).toBe(40);
    expect(stats.totalStaked).toBe(70);
    expect(stats.roi).toBeCloseTo(14.3, 1);
    expect(stats.equity).toHaveLength(3);
  });
});
