import type { Competition, Team } from '@/domain/types';

export interface MockTeam extends Team {
  /** Expected goals scored per match (attacking rating). */
  attack: number;
  /** Expected goals conceded per match (defensive frailty). */
  defense: number;
}

export interface MockCompetition extends Competition {
  teamIds: string[];
}

/** A compact but realistic-feeling set of teams across four competitions. */
export const MOCK_TEAMS: MockTeam[] = [
  // Primeira Liga (PT)
  { id: 'pt-ben', name: 'Benfica', country: 'Portugal', attack: 2.1, defense: 0.8 },
  { id: 'pt-por', name: 'FC Porto', country: 'Portugal', attack: 1.9, defense: 0.9 },
  { id: 'pt-spo', name: 'Sporting CP', country: 'Portugal', attack: 2.0, defense: 0.85 },
  { id: 'pt-bra', name: 'SC Braga', country: 'Portugal', attack: 1.6, defense: 1.1 },
  { id: 'pt-vit', name: 'Vitória SC', country: 'Portugal', attack: 1.3, defense: 1.3 },
  { id: 'pt-gui', name: 'Gil Vicente', country: 'Portugal', attack: 1.1, defense: 1.5 },
  // Premier League (EN)
  { id: 'en-mci', name: 'Manchester City', country: 'England', attack: 2.3, defense: 0.9 },
  { id: 'en-liv', name: 'Liverpool', country: 'England', attack: 2.2, defense: 1.0 },
  { id: 'en-ars', name: 'Arsenal', country: 'England', attack: 2.0, defense: 0.9 },
  { id: 'en-che', name: 'Chelsea', country: 'England', attack: 1.7, defense: 1.2 },
  { id: 'en-bre', name: 'Brentford', country: 'England', attack: 1.6, defense: 1.4 },
  { id: 'en-eve', name: 'Everton', country: 'England', attack: 1.2, defense: 1.3 },
  // La Liga (ES)
  { id: 'es-rma', name: 'Real Madrid', country: 'Spain', attack: 2.2, defense: 0.9 },
  { id: 'es-fcb', name: 'Barcelona', country: 'Spain', attack: 2.3, defense: 1.1 },
  { id: 'es-atm', name: 'Atlético Madrid', country: 'Spain', attack: 1.7, defense: 0.7 },
  { id: 'es-sev', name: 'Sevilla', country: 'Spain', attack: 1.4, defense: 1.2 },
  { id: 'es-bet', name: 'Real Betis', country: 'Spain', attack: 1.6, defense: 1.3 },
  { id: 'es-vil', name: 'Villarreal', country: 'Spain', attack: 1.7, defense: 1.2 },
  // Serie A (IT)
  { id: 'it-int', name: 'Inter', country: 'Italy', attack: 2.1, defense: 0.8 },
  { id: 'it-juv', name: 'Juventus', country: 'Italy', attack: 1.6, defense: 0.8 },
  { id: 'it-mil', name: 'AC Milan', country: 'Italy', attack: 1.8, defense: 1.1 },
  { id: 'it-nap', name: 'Napoli', country: 'Italy', attack: 1.9, defense: 1.0 },
  { id: 'it-ata', name: 'Atalanta', country: 'Italy', attack: 2.2, defense: 1.3 },
  { id: 'it-rom', name: 'Roma', country: 'Italy', attack: 1.7, defense: 1.1 },
];

export const MOCK_COMPETITIONS: MockCompetition[] = [
  {
    id: 'PPL',
    name: 'Primeira Liga',
    country: 'Portugal',
    teamIds: ['pt-ben', 'pt-por', 'pt-spo', 'pt-bra', 'pt-vit', 'pt-gui'],
  },
  {
    id: 'PL',
    name: 'Premier League',
    country: 'England',
    teamIds: ['en-mci', 'en-liv', 'en-ars', 'en-che', 'en-bre', 'en-eve'],
  },
  {
    id: 'PD',
    name: 'La Liga',
    country: 'Spain',
    teamIds: ['es-rma', 'es-fcb', 'es-atm', 'es-sev', 'es-bet', 'es-vil'],
  },
  {
    id: 'SA',
    name: 'Serie A',
    country: 'Italy',
    teamIds: ['it-int', 'it-juv', 'it-mil', 'it-nap', 'it-ata', 'it-rom'],
  },
];

const TEAM_BY_ID = new Map(MOCK_TEAMS.map((t) => [t.id, t]));

export function getMockTeam(id: string): MockTeam | undefined {
  return TEAM_BY_ID.get(id);
}

export function competitionOf(teamId: string): MockCompetition | undefined {
  return MOCK_COMPETITIONS.find((c) => c.teamIds.includes(teamId));
}
