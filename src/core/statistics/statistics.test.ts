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
  });
});
