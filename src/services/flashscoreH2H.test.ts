import { describe, it, expect } from 'vitest';
import { parseFlashscoreH2H, type FlashMatch } from './flashscoreH2H';

const m = (
  id: string,
  ts: number,
  status: string,
  home: string,
  hs: number,
  away: string,
  as: number,
  tournament = 'LaLiga',
): FlashMatch => ({
  match_id: id,
  timestamp: ts,
  status,
  tournament_name: tournament,
  home_team: { name: home, score: String(hs) },
  away_team: { name: away, score: String(as) },
});

// Sevilla recent, Real Madrid recent, and two pure H2H rows (status '').
const DATA: FlashMatch[] = [
  m('m1', 100, 'W', 'Sevilla', 2, 'Ath Bilbao', 1),
  m('m2', 90, 'L', 'Celta Vigo', 1, 'Sevilla', 0),
  m('m3', 95, 'W', 'Real Madrid', 3, 'Levante', 0),
  m('m4', 85, 'W', 'Getafe', 0, 'Real Madrid', 1),
  m('m5', 50, '', 'Sevilla', 1, 'Real Madrid', 1),
  m('m6', 40, '', 'Real Madrid', 2, 'Sevilla', 0),
];

describe('parseFlashscoreH2H', () => {
  const res = parseFlashscoreH2H(DATA)!;

  it('identifies the two subject teams from the H2H rows', () => {
    expect(res.teams.map((t) => t.name)).toEqual(['Sevilla', 'Real Madrid']);
  });

  it('computes Sevilla splits (overall/home/away)', () => {
    const sev = res.teams[0];
    expect(sev.overall).toEqual({ played: 4, goalsFor: 0.75, goalsAgainst: 1.25, bttsPct: 50 });
    expect(sev.home).toEqual({ played: 2, goalsFor: 1.5, goalsAgainst: 1, bttsPct: 100 });
    expect(sev.away).toEqual({ played: 2, goalsFor: 0, goalsAgainst: 1.5, bttsPct: 0 });
  });

  it('computes Real Madrid splits', () => {
    const rm = res.teams[1];
    expect(rm.overall).toEqual({ played: 4, goalsFor: 1.75, goalsAgainst: 0.25, bttsPct: 25 });
    expect(rm.home).toEqual({ played: 2, goalsFor: 2.5, goalsAgainst: 0, bttsPct: 0 });
    expect(rm.away).toEqual({ played: 2, goalsFor: 1, goalsAgainst: 0.5, bttsPct: 50 });
  });

  it('computes the head-to-head BTTS', () => {
    expect(res.h2h).toEqual({ played: 2, bttsPct: 50 });
  });

  it('excludes friendlies from the form windows', () => {
    const withFriendly = [
      ...DATA,
      m('f1', 200, 'D', 'Sevilla', 3, 'Some Club', 3, 'Club Friendly'),
    ];
    const sev = parseFlashscoreH2H(withFriendly)!.teams[0];
    // The friendly (most recent) must not change Sevilla's counts.
    expect(sev.overall.played).toBe(4);
  });

  it('returns null for non-array / empty input', () => {
    expect(parseFlashscoreH2H(null)).toBeNull();
    expect(parseFlashscoreH2H([])).toBeNull();
  });
});
