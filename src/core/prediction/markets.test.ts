import { describe, it, expect } from 'vitest';
import { predictMarkets, expectedGoals } from './markets';
import type { TeamStats, VenueStats, WindowStats } from '@/domain/types';

function window(avgFor: number, avgAgainst: number): WindowStats {
  return {
    played: 10,
    goalsFor: avgFor * 10,
    goalsAgainst: avgAgainst * 10,
    avgGoalsFor: avgFor,
    avgGoalsAgainst: avgAgainst,
    bttsPct: 0.5,
    over25Pct: 0.5,
    cleanSheetPct: 0.3,
    failedToScorePct: 0.3,
  };
}
const venue: VenueStats = { played: 5, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5, bttsPct: 0.5 };

function team(avgFor: number, avgAgainst: number): TeamStats {
  const w = window(avgFor, avgAgainst);
  return {
    team: { id: 't', name: 't' },
    last5: w,
    last10: w,
    home: venue,
    away: venue,
    recentForm: [],
  };
}

describe('predictMarkets', () => {
  it('produces 1X2 probabilities that sum to ~1', () => {
    const m = predictMarkets(team(1.6, 1.2), team(1.3, 1.4));
    expect(m.homeWin + m.draw + m.awayWin).toBeCloseTo(1, 2);
  });

  it('over + under 2.5 sum to ~1', () => {
    const m = predictMarkets(team(1.6, 1.2), team(1.3, 1.4));
    expect(m.over25 + m.under25).toBeCloseTo(1, 2);
  });

  it('high-scoring teams yield higher Over 2.5', () => {
    const low = predictMarkets(team(0.6, 0.5), team(0.5, 0.6));
    const high = predictMarkets(team(2.6, 2.0), team(2.4, 2.2));
    expect(high.over25).toBeGreaterThan(low.over25);
  });

  it('stronger home attack raises home win probability', () => {
    const m = predictMarkets(team(2.4, 0.8), team(0.8, 1.6));
    expect(m.homeWin).toBeGreaterThan(m.awayWin);
  });

  it('expectedGoals applies home advantage', () => {
    const { lambdaHome, lambdaAway } = expectedGoals(team(1.5, 1.5), team(1.5, 1.5));
    expect(lambdaHome).toBeGreaterThan(lambdaAway);
  });

  it('Dixon-Coles lifts the draw probability vs independent Poisson', () => {
    const home = team(1.3, 1.2);
    const away = team(1.2, 1.3);
    const { lambdaHome, lambdaAway } = expectedGoals(home, away);
    // Independent-Poisson draw for the same expected goals (no low-score τ).
    const poisson = (k: number, l: number): number => {
      let f = 1;
      for (let i = 2; i <= k; i++) f *= i;
      return (Math.exp(-l) * l ** k) / f;
    };
    let indepDraw = 0;
    for (let g = 0; g <= 8; g++) indepDraw += poisson(g, lambdaHome) * poisson(g, lambdaAway);
    const m = predictMarkets(home, away);
    // ρ<0 boosts 0-0 and 1-1, so the modelled draw is higher than independent.
    expect(m.draw).toBeGreaterThan(indepDraw);
  });

  it('keeps all market probabilities within [0, 1]', () => {
    const m = predictMarkets(team(3.2, 0.4), team(0.3, 3.5));
    for (const p of [m.over25, m.under25, m.homeWin, m.draw, m.awayWin]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});
