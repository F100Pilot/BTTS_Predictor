import { describe, it, expect } from 'vitest';
import { isMinorCompetition, isMajorCompetition } from './competitions';

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

describe('isMajorCompetition', () => {
  it('accepts top leagues and world/continental tournaments', () => {
    const major = [
      'Premier League',
      'La Liga',
      'LaLiga',
      'Primera División',
      'Serie A',
      'Bundesliga',
      'Ligue 1',
      'Liga Portugal',
      'Primeira Liga',
      'Eredivisie',
      'Championship',
      'FIFA World Cup',
      'UEFA Champions League',
      'Europa League',
      'UEFA Euro 2024',
      'European Championship',
      'Copa América',
      'UEFA Nations League',
      'Copa Libertadores',
      'FIFA Club World Cup',
    ];
    for (const name of major) expect(isMajorCompetition(name)).toBe(true);
  });

  it('rejects minor / second-tier-foreign leagues and youth variants', () => {
    const notMajor = [
      'Liga II',
      'Regionalliga',
      'Serie C',
      'National League',
      'Primera B',
      'World Cup U20', // youth → excluded even though it says World Cup
      'Premier League U21',
    ];
    for (const name of notMajor) expect(isMajorCompetition(name)).toBe(false);
  });
});
