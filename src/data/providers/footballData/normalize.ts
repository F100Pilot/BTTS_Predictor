import type { Competition, Fixture, LiveMatch, MatchResult, Team } from '@/domain/types';
import { sanitizeText } from '@/services/sanitize';

/** Subset of the Football-Data.org v4 match shape we rely on. */
export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  minute?: number;
  competition?: { id: number; name: string; emblem?: string; area?: { name?: string } };
  homeTeam: { id: number; name: string; shortName?: string; crest?: string };
  awayTeam: { id: number; name: string; shortName?: string; crest?: string };
  score?: { fullTime?: { home: number | null; away: number | null } };
}

/** Map an in-play match; current goals live in score.fullTime during the game. */
export function normalizeLive(m: FdMatch): LiveMatch {
  const country = m.competition?.area?.name;
  return {
    id: String(m.id),
    competition: toCompetition(m.competition),
    home: toTeam(m.homeTeam, country),
    away: toTeam(m.awayTeam, country),
    homeGoals: m.score?.fullTime?.home ?? 0,
    awayGoals: m.score?.fullTime?.away ?? 0,
    status: m.status,
    minute: typeof m.minute === 'number' ? m.minute : undefined,
    date: m.utcDate,
  };
}

function toTeam(t: FdMatch['homeTeam'], country?: string): Team {
  return {
    id: String(t.id),
    name: sanitizeText(t.name),
    shortName: t.shortName ? sanitizeText(t.shortName) : undefined,
    crest: t.crest,
    country,
  };
}

function toCompetition(c: FdMatch['competition']): Competition {
  return {
    id: c ? String(c.id) : 'unknown',
    name: c ? sanitizeText(c.name) : 'Desconhecida',
    country: c?.area?.name ? sanitizeText(c.area.name) : undefined,
    emblem: c?.emblem,
  };
}

export function normalizeFixture(m: FdMatch): Fixture {
  const country = m.competition?.area?.name;
  return {
    id: String(m.id),
    date: m.utcDate,
    competition: toCompetition(m.competition),
    home: toTeam(m.homeTeam, country),
    away: toTeam(m.awayTeam, country),
  };
}

/** Returns null for matches without a full-time score (not finished). */
export function normalizeResult(m: FdMatch): MatchResult | null {
  const home = m.score?.fullTime?.home;
  const away = m.score?.fullTime?.away;
  if (home == null || away == null) return null;
  const country = m.competition?.area?.name;
  return {
    id: String(m.id),
    date: m.utcDate,
    competitionId: m.competition ? String(m.competition.id) : undefined,
    competitionName: m.competition ? sanitizeText(m.competition.name) : undefined,
    home: toTeam(m.homeTeam, country),
    away: toTeam(m.awayTeam, country),
    homeGoals: home,
    awayGoals: away,
  };
}
