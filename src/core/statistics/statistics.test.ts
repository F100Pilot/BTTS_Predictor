import { describe, it, expect } from 'vitest';
import { computeTeamStats, computeHeadToHead } from './statistics';
import type { MatchResult, Team } from '@/domain/types';

const teamA: Team = { id: 'a', name: 'Team A' };
const teamB: Team = { id: 'b', name: 'Team B' };
const teamC: Team = { id: 'c', name: 'Team C' };

function match(
  id: string,
  home: Team,
  away: Team,
  hg: number,
  ag: number,
  date: string,
): MatchResult {
  return { id, date, home, away, homeGoals: hg, awayGoals: ag };
}

describe('computeTeamStats', () => {
  const matches: MatchResult[] = [
    match('1', teamA, teamB, 2, 1, '2026-05-01'), // A home W, btts
    match('2', teamC, teamA, 0, 0, '2026-05-08'), // A away D, no btts, A failed to score, A clean sheet
    match('3', teamA, teamC, 3, 0, '2026-05-15'), // A home W, no btts, clean sheet
  ];

  it('computes goal averages and percentages from team perspective', () => {
    const stats = computeTeamStats(teamA, matches);
    expect(stats.last5.played).toBe(3);
    expect(stats.last5.goalsFor).toBe(5); // 2 + 0 + 3
    expect(stats.last5.goalsAgainst).toBe(1); // 1 + 0 + 0
    expect(stats.last5.bttsPct).toBeCloseTo(1 / 3, 5);
    expect(stats.last5.cleanSheetPct).toBeCloseTo(2 / 3, 5);
    expect(stats.last5.failedToScorePct).toBeCloseTo(1 / 3, 5);
  });

  it('separates home and away venues', () => {
    const stats = computeTeamStats(teamA, matches);
    expect(stats.home.played).toBe(2);
    expect(stats.away.played).toBe(1);
  });

  it('ignores matches the team did not play in', () => {
    const stats = computeTeamStats(teamA, [match('x', teamB, teamC, 1, 1, '2026-05-01')]);
    expect(stats.last5.played).toBe(0);
    expect(stats.last5.avgGoalsFor).toBe(0);
  });
});

describe('computeHeadToHead', () => {
  it('only counts direct encounters', () => {
    const matches: MatchResult[] = [
      match('1', teamA, teamB, 1, 1, '2025-01-01'),
      match('2', teamB, teamA, 2, 0, '2024-01-01'),
      match('3', teamA, teamC, 3, 0, '2023-01-01'),
    ];
    const h2h = computeHeadToHead('a', 'b', matches);
    expect(h2h.played).toBe(2);
    expect(h2h.bttsPct).toBeCloseTo(0.5, 5);
    expect(h2h.avgGoals).toBeCloseTo(2, 5); // (2 + 2) / 2
    expect(h2h.bttsPctWeighted).toBeUndefined(); // only with adjust options
  });

  it('adds a recency-weighted BTTS rate without touching the raw one', () => {
    const now = Date.parse('2026-06-01T00:00:00Z');
    const recentYes = computeHeadToHead(
      'a',
      'b',
      [
        match('1', teamA, teamB, 1, 1, '2026-05-25'), // recent: btts
        match('2', teamA, teamB, 2, 0, '2022-01-01'), // old: no btts
      ],
      10,
      { now },
    );
    const recentNo = computeHeadToHead(
      'a',
      'b',
      [
        match('1', teamA, teamB, 2, 0, '2026-05-25'), // recent: no btts
        match('2', teamA, teamB, 1, 1, '2022-01-01'), // old: btts
      ],
      10,
      { now },
    );
    expect(recentYes.bttsPct).toBeCloseTo(0.5, 5); // raw unchanged
    expect(recentYes.bttsPctWeighted ?? 0).toBeGreaterThan(recentNo.bttsPctWeighted ?? 1);
  });
});

describe('computeTeamStats (adjusted)', () => {
  const now = Date.parse('2026-06-01T00:00:00Z');

  it('leaves raw windows untouched and adds an adjusted bundle', () => {
    const stats = computeTeamStats(teamA, [match('1', teamA, teamB, 4, 0, '2026-06-01')], { now });
    expect(stats.last5.avgGoalsFor).toBe(4); // raw stays the true average
    const adj = stats.adjusted;
    expect(adj).toBeDefined();
    if (!adj) return;
    // A single 4-goal game is shrunk toward the league prior (~1.35).
    expect(adj.last5.avgGoalsFor).toBeLessThan(4);
    expect(adj.last5.avgGoalsFor).toBeGreaterThan(1.35);
    expect(adj.last5.played).toBe(1); // count preserved
  });

  it('weights recent matches more than old ones (recency decay)', () => {
    const recentBtts = computeTeamStats(
      teamA,
      [
        match('r', teamA, teamB, 1, 1, '2026-06-01'), // recent: btts yes
        match('o', teamA, teamC, 3, 0, '2025-06-01'), // ~1y old: no btts
      ],
      { now },
    ).adjusted;
    const recentNoBtts = computeTeamStats(
      teamA,
      [
        match('r', teamA, teamB, 3, 0, '2026-06-01'), // recent: no btts
        match('o', teamA, teamC, 1, 1, '2025-06-01'), // old: btts yes
      ],
      { now },
    ).adjusted;
    expect((recentBtts?.last10.bttsPct ?? 0) > (recentNoBtts?.last10.bttsPct ?? 1)).toBe(true);
  });

  it('does not attach an adjusted bundle without options', () => {
    const stats = computeTeamStats(teamA, [match('1', teamA, teamB, 2, 1, '2026-05-01')]);
    expect(stats.adjusted).toBeUndefined();
  });
});
