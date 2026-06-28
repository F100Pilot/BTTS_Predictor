import { describe, expect, it } from 'vitest';
import { flashscoreFixtureMatches } from './flashscoreAnalysis';
import type { Team } from '@/domain/types';

const home: Team = { id: 'H', name: 'Alpha FC' };
const away: Team = { id: 'A', name: 'Beta FC' };

/** Minimal Flashscore h2h-style row. */
function row(
  id: string,
  homeName: string,
  awayName: string,
  hg: number | null,
  ag: number | null,
  ts: number,
  tournament = 'League',
) {
  return {
    match_id: id,
    timestamp: ts,
    tournament_name: tournament,
    home_team: { name: homeName, score: hg },
    away_team: { name: awayName, score: ag },
  };
}

describe('flashscoreFixtureMatches', () => {
  it('splits a flat h2h payload into each team’s recent matches', () => {
    const input = [
      row('1', 'Alpha FC', 'Gamma FC', 2, 1, 100),
      row('2', 'Delta FC', 'Alpha FC', 0, 0, 90),
      row('3', 'Beta FC', 'Epsilon FC', 3, 2, 80),
      row('4', 'Zeta FC', 'Beta FC', 1, 1, 70),
      // direct encounter appears in both teams' histories
      row('5', 'Alpha FC', 'Beta FC', 2, 2, 60),
    ];
    const { home: h, away: a } = flashscoreFixtureMatches(input, home, away);

    expect(h.map((m) => m.id)).toEqual(['1', '2', '5']);
    expect(a.map((m) => m.id)).toEqual(['3', '4', '5']);
  });

  it('assigns the fixture’s real ids to the subject teams', () => {
    const input = [row('5', 'Alpha FC', 'Beta FC', 2, 2, 60)];
    const { home: h } = flashscoreFixtureMatches(input, home, away);
    expect(h[0]!.home.id).toBe('H');
    expect(h[0]!.away.id).toBe('A');
  });

  it('excludes friendlies', () => {
    const input = [
      row('1', 'Alpha FC', 'Gamma FC', 2, 1, 100, 'Club Friendly'),
      row('2', 'Alpha FC', 'Delta FC', 1, 0, 90, 'League'),
    ];
    const { home: h } = flashscoreFixtureMatches(input, home, away);
    expect(h.map((m) => m.id)).toEqual(['2']);
  });

  it('drops rows without a final score', () => {
    const input = [
      row('1', 'Alpha FC', 'Gamma FC', null, null, 100),
      row('2', 'Alpha FC', 'Delta FC', 1, 0, 90),
    ];
    const { home: h } = flashscoreFixtureMatches(input, home, away);
    expect(h.map((m) => m.id)).toEqual(['2']);
  });

  it('dedupes by id and sorts newest-first', () => {
    const input = [
      row('1', 'Alpha FC', 'Gamma FC', 2, 1, 50),
      row('1', 'Alpha FC', 'Gamma FC', 2, 1, 50),
      row('2', 'Alpha FC', 'Delta FC', 1, 0, 200),
    ];
    const { home: h } = flashscoreFixtureMatches(input, home, away);
    expect(h.map((m) => m.id)).toEqual(['2', '1']);
  });

  it('returns empty lists for an unusable payload', () => {
    expect(flashscoreFixtureMatches(null, home, away)).toEqual({ home: [], away: [] });
    expect(flashscoreFixtureMatches({}, home, away)).toEqual({ home: [], away: [] });
  });
});
