import { describe, it, expect } from 'vitest';
import { predict } from './engine';
import { DEFAULT_WEIGHTS } from './weights';
import type { HeadToHead, TeamStats, VenueStats, WindowStats } from '@/domain/types';

function window(partial: Partial<WindowStats>): WindowStats {
  return {
    played: 10,
    goalsFor: 0,
    goalsAgainst: 0,
    avgGoalsFor: 1.5,
    avgGoalsAgainst: 1.5,
    bttsPct: 0.5,
    over25Pct: 0.5,
    cleanSheetPct: 0.3,
    failedToScorePct: 0.3,
    ...partial,
  };
}

function venue(partial: Partial<VenueStats>): VenueStats {
  return { played: 5, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5, bttsPct: 0.5, ...partial };
}

function team(name: string, w: Partial<WindowStats>): TeamStats {
  // Mirror the window's goal averages into venue stats so the venue-aware form
  // model sees a consistent scenario (real venue stats derive from the matches).
  const vs = {
    bttsPct: w.bttsPct,
    avgGoalsFor: w.avgGoalsFor ?? 1.5,
    avgGoalsAgainst: w.avgGoalsAgainst ?? 1.5,
  };
  return {
    team: { id: name, name },
    last5: window(w),
    last10: window(w),
    home: venue(vs),
    away: venue(vs),
    recentForm: [],
  };
}

const noH2h: HeadToHead = { matches: [], played: 0, bttsPct: 0, avgGoals: 0 };

describe('predict', () => {
  it('returns complementary probabilities summing to 1', () => {
    const p = predict({
      home: team('A', { bttsPct: 0.6, avgGoalsFor: 1.8, avgGoalsAgainst: 1.4 }),
      away: team('B', { bttsPct: 0.6, avgGoalsFor: 1.7, avgGoalsAgainst: 1.5 }),
      h2h: noH2h,
    });
    expect(p.probYes + p.probNo).toBeCloseTo(1, 5);
    expect(p.probYes).toBeGreaterThanOrEqual(0);
    expect(p.probYes).toBeLessThanOrEqual(1);
  });

  it('predicts high BTTS for two high-scoring leaky teams', () => {
    const high = predict({
      home: team('A', { bttsPct: 0.9, avgGoalsFor: 2.6, avgGoalsAgainst: 2.2 }),
      away: team('B', { bttsPct: 0.9, avgGoalsFor: 2.5, avgGoalsAgainst: 2.0 }),
      h2h: { matches: [], played: 4, bttsPct: 0.9, avgGoals: 3.5 },
    });
    expect(high.probYes).toBeGreaterThan(0.7);
    expect(['very-strong', 'strong']).toContain(high.tier);
  });

  it('predicts low BTTS for solid defenses that rarely concede', () => {
    const low = predict({
      home: team('A', { bttsPct: 0.1, avgGoalsFor: 0.8, avgGoalsAgainst: 0.3, cleanSheetPct: 0.8 }),
      away: team('B', { bttsPct: 0.1, avgGoalsFor: 0.6, avgGoalsAgainst: 0.4, cleanSheetPct: 0.7 }),
      h2h: { matches: [], played: 4, bttsPct: 0.1, avgGoals: 1.2 },
    });
    expect(low.probYes).toBeLessThan(0.5);
  });

  it('does not throw on empty/zero data and stays in range', () => {
    const empty = predict({
      home: team('A', { played: 0, avgGoalsFor: 0, avgGoalsAgainst: 0, bttsPct: 0 }),
      away: team('B', { played: 0, avgGoalsFor: 0, avgGoalsAgainst: 0, bttsPct: 0 }),
      h2h: noH2h,
    });
    expect(Number.isNaN(empty.probYes)).toBe(false);
    expect(empty.confidence).toBeGreaterThanOrEqual(0);
    expect(empty.confidence).toBeLessThanOrEqual(10);
  });

  it('stays neutral (~50/50) and flags weak/insufficient when there is no data', () => {
    const empty = predict({
      home: team('A', { played: 0, avgGoalsFor: 0, avgGoalsAgainst: 0, bttsPct: 0 }),
      away: team('B', { played: 0, avgGoalsFor: 0, avgGoalsAgainst: 0, bttsPct: 0 }),
      h2h: noH2h,
    });
    // No data must NOT produce a confident "NÃO 92%" / Muito Forte verdict.
    expect(empty.probYes).toBeGreaterThan(0.4);
    expect(empty.probYes).toBeLessThan(0.6);
    expect(empty.insufficientData).toBe(true);
    expect(empty.tier).toBe('weak');
  });

  it('weights sum to 1 by default', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('lower data availability yields lower confidence', () => {
    const rich = predict({
      home: team('A', { played: 10, bttsPct: 0.8 }),
      away: team('B', { played: 10, bttsPct: 0.8 }),
      h2h: { matches: [], played: 4, bttsPct: 0.8, avgGoals: 3 },
    });
    const poor = predict({
      home: team('A', { played: 1, bttsPct: 0.8 }),
      away: team('B', { played: 1, bttsPct: 0.8 }),
      h2h: noH2h,
    });
    expect(rich.confidence).toBeGreaterThan(poor.confidence);
  });
});
