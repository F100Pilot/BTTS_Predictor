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

  it('parses the live minute from match_status (number or "67\'" string)', () => {
    const data = [
      {
        name: 'X',
        country_name: 'Y',
        matches: [
          {
            match_id: 'M1',
            timestamp: 1,
            match_status: { is_in_progress: true, minute: 67 },
            home_team: { team_id: 'h', name: 'A' },
            away_team: { team_id: 'a', name: 'B' },
            scores: { home: 0, away: 0 },
          },
          {
            match_id: 'M2',
            timestamp: 2,
            match_status: { is_in_progress: true, time: "45'" },
            home_team: { team_id: 'h', name: 'C' },
            away_team: { team_id: 'a', name: 'D' },
            scores: { home: 1, away: 0 },
          },
          {
            match_id: 'M3',
            timestamp: 3,
            match_status: { is_in_progress: true },
            home_team: { team_id: 'h', name: 'E' },
            away_team: { team_id: 'a', name: 'F' },
            scores: { home: 0, away: 0 },
          },
        ],
      },
    ];
    const [a, b, c] = parseFlashscoreMatches(data);
    expect(a!.minute).toBe(67);
    expect(b!.minute).toBe(45);
    expect(c!.minute).toBeNull();
  });
});
