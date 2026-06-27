import { describe, it, expect } from 'vitest';
import { parseFlashscoreMatches, upcomingOnly } from './flashscoreMatches';

const DATA = [
  {
    name: 'SPAIN: LaLiga',
    country_name: 'Spain',
    matches: [
      {
        match_id: 'AAA',
        timestamp: 100,
        match_status: { is_started: true, is_in_progress: false, is_finished: true },
        home_team: { team_id: 'h1', name: 'Girona' },
        away_team: { team_id: 'a1', name: 'Getafe' },
        scores: { home: 1, away: 1 },
        odds: [],
      },
      {
        match_id: 'BBB',
        timestamp: 200,
        match_status: { is_started: false, is_in_progress: false, is_finished: false },
        home_team: { team_id: 'h2', name: 'Sevilla' },
        away_team: { team_id: 'a2', name: 'Real Madrid' },
        scores: { home: null, away: null },
        odds: { '1': 2.2, X: 3.1, '2': 3.0 },
      },
    ],
  },
];

describe('parseFlashscoreMatches', () => {
  const fixtures = parseFlashscoreMatches(DATA);

  it('flattens groups into fixtures with status', () => {
    expect(fixtures).toHaveLength(2);
    expect(fixtures[0]).toMatchObject({
      matchId: 'AAA',
      status: 'finished',
      tournament: 'SPAIN: LaLiga',
      country: 'Spain',
      home: { id: 'h1', name: 'Girona' },
      away: { id: 'a1', name: 'Getafe' },
    });
  });

  it('parses 1X2 odds when present and omits empty', () => {
    expect(fixtures[0]!.odds).toBeUndefined();
    expect(fixtures[1]!.odds).toEqual({ home: 2.2, draw: 3.1, away: 3.0 });
  });

  it('marks not-started matches scheduled', () => {
    expect(fixtures[1]!.status).toBe('scheduled');
    expect(upcomingOnly(fixtures).map((f) => f.matchId)).toEqual(['BBB']);
  });

  it('returns [] for non-array input', () => {
    expect(parseFlashscoreMatches(null)).toEqual([]);
  });
});
