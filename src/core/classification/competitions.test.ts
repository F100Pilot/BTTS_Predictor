import { describe, it, expect } from 'vitest';
import { isMinorCompetition } from './competitions';

describe('isMinorCompetition', () => {
  it('flags youth, friendly, reserve and amateur competitions', () => {
    const minor = [
      'Npl Nsw U20',
      'Friendlies Clubs',
      'Premier League U21',
      'Sub-23 Liga',
      'Youth League',
      'Bundesliga II Reserves',
      'Amateur Cup',
      'Primavera 1',
    ];
    for (const name of minor) expect(isMinorCompetition(name)).toBe(true);
  });

  it('keeps senior professional competitions', () => {
    const senior = [
      'Premier League',
      'La Liga',
      'Serie A',
      'Liga Portugal',
      'Champions League',
      'Eredivisie',
      'Liga II', // Romanian 2nd division — still professional
    ];
    for (const name of senior) expect(isMinorCompetition(name)).toBe(false);
  });
});
