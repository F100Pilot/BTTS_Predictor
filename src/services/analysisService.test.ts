import { describe, it, expect } from 'vitest';
import type { DataService } from '@/data/DataService';
import type { Fixture, MatchResult, SeasonStats, Team } from '@/domain/types';
import { buildAnalysis, buildDashboardRow, sortDashboardRows } from './analysisService';
import { IDENTITY_PLATT } from '@/core/backtest/backtest';

const team = (id: string, name: string): Team => ({ id, name });

const HOME = team('h', 'Home');
const AWAY = team('a', 'Away');

const fixture = (over: Partial<Fixture> = {}): Fixture => ({
  id: 'fx1',
  date: '2026-03-01T18:00:00Z',
  competition: { id: 'L1', name: 'League' },
  home: HOME,
  away: AWAY,
  ...over,
});

const match = (
  id: string,
  h: Team,
  a: Team,
  hg: number,
  ag: number,
  date = '2026-02-01',
): MatchResult => ({
  id,
  date,
  home: h,
  away: a,
  homeGoals: hg,
  awayGoals: ag,
});

/** Build a stub DataService exposing only the methods buildAnalysis uses. */
function stubData(opts: {
  home: MatchResult[];
  away: MatchResult[];
  season?: SeasonStats | null;
  throwRecent?: boolean;
}): { data: DataService; seasonCalls: number } {
  let seasonCalls = 0;
  const data = {
    getTeamRecentMatches: async (teamId: string) => {
      if (opts.throwRecent) throw new Error('429');
      return teamId === HOME.id ? opts.home : opts.away;
    },
    getTeamSeasonStats: async () => {
      seasonCalls += 1;
      return opts.season ?? null;
    },
  } as unknown as DataService;
  return {
    data,
    get seasonCalls() {
      return seasonCalls;
    },
  };
}

const season: SeasonStats = {
  played: 20,
  avgGoalsFor: 1.6,
  avgGoalsAgainst: 1.1,
  avgGoalsForHome: 1.9,
  avgGoalsForAway: 1.3,
  avgGoalsAgainstHome: 0.9,
  avgGoalsAgainstAway: 1.3,
  cleanSheetPct: 0.3,
  failedToScorePct: 0.2,
};

describe('buildAnalysis', () => {
  it('produces a prediction + markets and dedupes the shared H2H match', async () => {
    // A direct encounter between Home and Away appears in BOTH teams' histories.
    const shared = match('shared', HOME, AWAY, 2, 1, '2026-01-15');
    const home = [
      shared,
      match('h2', HOME, team('x', 'X'), 1, 1),
      match('h3', team('y', 'Y'), HOME, 0, 2),
      match('h4', HOME, team('z', 'Z'), 3, 0),
    ];
    const away = [
      shared, // same id → must be deduped in the H2H pool
      match('a2', AWAY, team('x', 'X'), 0, 0),
      match('a3', team('y', 'Y'), AWAY, 2, 2),
      match('a4', AWAY, team('z', 'Z'), 1, 1),
    ];
    const { data } = stubData({ home, away });
    const bundle = await buildAnalysis(data, fixture());

    expect(bundle.prediction.probYes).toBeGreaterThanOrEqual(0);
    expect(bundle.prediction.probYes).toBeLessThanOrEqual(1);
    expect(bundle.markets).toBeTruthy();
    // Only the single shared encounter counts as H2H (not double-counted).
    expect(bundle.h2h.played).toBe(1);
  });

  it('falls back to season stats when recent history is thin (<3 games)', async () => {
    const stub = stubData({
      home: [match('h1', HOME, team('x', 'X'), 1, 0)], // only 1 game → thin
      away: [match('a1', AWAY, team('y', 'Y'), 2, 2)],
      season,
    });
    const bundle = await buildAnalysis(stub.data, fixture());
    expect(stub.seasonCalls).toBe(2); // fetched for both thin teams
    expect(bundle.homeStats.seasonStats).toEqual(season);
    expect(bundle.awayStats.seasonStats).toEqual(season);
  });

  it('does not fetch season stats when the league id is unknown', async () => {
    const stub = stubData({ home: [], away: [], season });
    await buildAnalysis(stub.data, fixture({ competition: { id: 'unknown', name: '?' } }));
    expect(stub.seasonCalls).toBe(0);
  });

  it('applies a non-identity Platt recalibration', async () => {
    const home = [
      match('h2', HOME, team('x', 'X'), 2, 2),
      match('h3', HOME, team('y', 'Y'), 1, 1),
      match('h4', HOME, team('z', 'Z'), 3, 1),
    ];
    const away = [
      match('a2', AWAY, team('x', 'X'), 1, 1),
      match('a3', AWAY, team('y', 'Y'), 2, 2),
      match('a4', AWAY, team('z', 'Z'), 0, 1),
    ];
    const base = await buildAnalysis(stubData({ home, away }).data, fixture());
    const recal = await buildAnalysis(stubData({ home, away }).data, fixture(), {
      recalibration: { a: 2, b: 0.5 }, // not identity
    });
    expect(recal.prediction.recalibrated).toBe(true);
    expect(recal.prediction.probYes).not.toBe(base.prediction.probYes);
  });

  it('applies Over/Under 2.5 recalibration to the markets (sum stays 1)', async () => {
    const home = [
      match('h2', HOME, team('x', 'X'), 2, 2),
      match('h3', HOME, team('y', 'Y'), 1, 1),
      match('h4', HOME, team('z', 'Z'), 3, 1),
    ];
    const away = [
      match('a2', AWAY, team('x', 'X'), 1, 1),
      match('a3', AWAY, team('y', 'Y'), 2, 2),
      match('a4', AWAY, team('z', 'Z'), 0, 1),
    ];
    const base = await buildAnalysis(stubData({ home, away }).data, fixture());
    const recal = await buildAnalysis(stubData({ home, away }).data, fixture(), {
      ou25Recalibration: { a: 2, b: 0.5 }, // not identity
    });
    expect(recal.markets.over25).not.toBe(base.markets.over25);
    expect(recal.markets.over25 + recal.markets.under25).toBeCloseTo(1, 4);
  });

  it('identity recalibration is a no-op', async () => {
    const home = [
      match('h2', HOME, team('x', 'X'), 2, 2),
      match('h3', HOME, team('y', 'Y'), 1, 1),
      match('h4', HOME, team('z', 'Z'), 3, 1),
    ];
    const away = [
      match('a2', AWAY, team('x', 'X'), 1, 1),
      match('a3', AWAY, team('y', 'Y'), 2, 2),
      match('a4', AWAY, team('z', 'Z'), 0, 1),
    ];
    const bundle = await buildAnalysis(stubData({ home, away }).data, fixture(), {
      recalibration: IDENTITY_PLATT,
    });
    expect(bundle.prediction.recalibrated).toBeFalsy();
  });
});

describe('buildDashboardRow', () => {
  it('returns predictionError (never throws) when the data layer fails', async () => {
    const { data } = stubData({ home: [], away: [], throwRecent: true });
    const row = await buildDashboardRow(data, fixture());
    expect(row.predictionError).toBe(true);
    expect(row.prediction).toBeUndefined();
  });
});

describe('sortDashboardRows', () => {
  it('orders by BTTS=yes probability, rows without a prediction last', () => {
    const rows = [
      { fixture: fixture({ id: 'low' }), prediction: { probYes: 0.3 } as never },
      { fixture: fixture({ id: 'none' }) },
      { fixture: fixture({ id: 'high' }), prediction: { probYes: 0.9 } as never },
    ];
    expect(sortDashboardRows(rows).map((r) => r.fixture.id)).toEqual(['high', 'low', 'none']);
  });
});
