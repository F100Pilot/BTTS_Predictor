import { describe, it, expect } from 'vitest';
import { flashOutcome, buildFixtureIndex, splitFixtureName } from './flashscoreSettle';
import type { FlashFixture } from './flashscoreMatches';

const fx = (over: Partial<FlashFixture>): FlashFixture => ({
  matchId: 'm1',
  timestamp: 1,
  status: 'finished',
  tournament: 'T',
  country: 'C',
  home: { id: 'h', name: 'Al-Hidd' },
  away: { id: 'a', name: 'Bahrain SC' },
  scores: { home: 1, away: 1 },
  minute: null,
  ...over,
});

describe('flashOutcome', () => {
  it('settles a finished game to the final BTTS', () => {
    expect(flashOutcome(fx({ scores: { home: 1, away: 1 } }))).toEqual({
      outcome: 'yes',
      score: '1-1',
    });
    expect(flashOutcome(fx({ scores: { home: 2, away: 0 } }))).toEqual({
      outcome: 'no',
      score: '2-0',
    });
  });

  it('locks an early "yes" when both teams scored in play', () => {
    expect(flashOutcome(fx({ status: 'live', scores: { home: 1, away: 2 } }))).toEqual({
      outcome: 'yes',
      score: '1-2',
    });
  });

  it('does not settle an in-play game where one side has not scored', () => {
    expect(flashOutcome(fx({ status: 'live', scores: { home: 1, away: 0 } }))).toBeNull();
    expect(flashOutcome(fx({ status: 'live', scores: { home: 0, away: 0 } }))).toBeNull();
  });

  it('does not settle when a score is missing', () => {
    expect(flashOutcome(fx({ status: 'live', scores: { home: null, away: null } }))).toBeNull();
  });
});

describe('splitFixtureName', () => {
  it('splits "Home vs Away"', () => {
    expect(splitFixtureName('Al-Hidd vs Bahrain SC')).toEqual(['Al-Hidd', 'Bahrain SC']);
    expect(splitFixtureName('Al-Hidd vs. Bahrain SC')).toEqual(['Al-Hidd', 'Bahrain SC']);
  });
  it('returns null when not a pair', () => {
    expect(splitFixtureName('just one')).toBeNull();
  });
});

describe('buildFixtureIndex', () => {
  const idx = buildFixtureIndex([
    fx({ matchId: 'vJPX62Pi' }),
    fx({
      matchId: 'other',
      home: { id: 'x', name: 'Al Ahly' },
      away: { id: 'y', name: 'Wadi Degla' },
    }),
  ]);

  it('matches by Flashscore match id first', () => {
    expect(idx.find('vJPX62Pi', 'whatever vs nonsense')?.matchId).toBe('vJPX62Pi');
  });

  it('falls back to the team-name pair (case/space-insensitive)', () => {
    expect(idx.find(undefined, '  al ahly  vs WADI DEGLA')?.matchId).toBe('other');
  });

  it('returns undefined when nothing matches', () => {
    expect(idx.find('nope', 'a vs b')).toBeUndefined();
  });
});
