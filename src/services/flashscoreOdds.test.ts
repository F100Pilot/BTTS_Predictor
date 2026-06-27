import { describe, it, expect } from 'vitest';
import { parseFlashscoreBttsOdds } from './flashscoreOdds';

const btts = (scope: string, yes: string, no: string) => ({
  bettingType: 'BOTH_TEAMS_TO_SCORE',
  bettingScope: scope,
  odds: [
    { value: yes, bothTeamsToScore: true },
    { value: no, bothTeamsToScore: false },
  ],
});

const DATA = [
  {
    name: 'bet365.us',
    odds: [
      { bettingType: 'HOME_DRAW_AWAY', bettingScope: 'FULL_TIME', odds: [{ value: '3.0' }] },
      btts('FIRST_HALF', '3.5', '1.29'),
      btts('FULL_TIME', '1.5', '2.5'),
    ],
  },
  {
    name: 'BetMGM.us',
    odds: [btts('FULL_TIME', '1.49', '2.45')],
  },
];

describe('parseFlashscoreBttsOdds', () => {
  it('averages full-time BTTS Yes/No across bookmakers', () => {
    const res = parseFlashscoreBttsOdds(DATA)!;
    expect(res.bookmakers).toBe(2);
    expect(res.yes).toBe(1.5); // (1.5 + 1.49) / 2 = 1.495 → 1.5
    expect(res.no).toBe(2.48); // (2.5 + 2.45) / 2 = 2.475 → 2.48
  });

  it('ignores non-full-time scopes and other markets', () => {
    const onlyHalf = [{ name: 'x', odds: [btts('FIRST_HALF', '3.5', '1.29')] }];
    expect(parseFlashscoreBttsOdds(onlyHalf)).toBeNull();
  });

  it('unwraps a wrapped payload and returns null when no BTTS market', () => {
    expect(parseFlashscoreBttsOdds({ data: DATA })?.bookmakers).toBe(2);
    expect(parseFlashscoreBttsOdds(null)).toBeNull();
    expect(parseFlashscoreBttsOdds([{ name: 'x', odds: [] }])).toBeNull();
  });
});
