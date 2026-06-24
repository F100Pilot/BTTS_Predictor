import type {
  FormEntry,
  HeadToHead,
  MatchResult,
  Team,
  TeamStats,
  Venue,
  VenueStats,
  WindowStats,
} from '@/domain/types';
import { average, ratio, safeDivide } from '@/lib/math';

interface PerspectiveMatch {
  match: MatchResult;
  venue: Venue;
  goalsFor: number;
  goalsAgainst: number;
}

/** Reduce a match to the given team's perspective. */
function toPerspective(match: MatchResult, teamId: string): PerspectiveMatch | null {
  if (match.home.id === teamId) {
    return { match, venue: 'home', goalsFor: match.homeGoals, goalsAgainst: match.awayGoals };
  }
  if (match.away.id === teamId) {
    return { match, venue: 'away', goalsFor: match.awayGoals, goalsAgainst: match.homeGoals };
  }
  return null;
}

const EMPTY_WINDOW: WindowStats = {
  played: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  avgGoalsFor: 0,
  avgGoalsAgainst: 0,
  bttsPct: 0,
  over25Pct: 0,
  cleanSheetPct: 0,
  failedToScorePct: 0,
};

function computeWindow(matches: PerspectiveMatch[]): WindowStats {
  if (matches.length === 0) return { ...EMPTY_WINDOW };
  const goalsFor = matches.reduce((s, m) => s + m.goalsFor, 0);
  const goalsAgainst = matches.reduce((s, m) => s + m.goalsAgainst, 0);
  return {
    played: matches.length,
    goalsFor,
    goalsAgainst,
    avgGoalsFor: safeDivide(goalsFor, matches.length),
    avgGoalsAgainst: safeDivide(goalsAgainst, matches.length),
    bttsPct: ratio(matches, (m) => m.goalsFor > 0 && m.goalsAgainst > 0),
    over25Pct: ratio(matches, (m) => m.goalsFor + m.goalsAgainst > 2.5),
    cleanSheetPct: ratio(matches, (m) => m.goalsAgainst === 0),
    failedToScorePct: ratio(matches, (m) => m.goalsFor === 0),
  };
}

function computeVenue(matches: PerspectiveMatch[]): VenueStats {
  return {
    played: matches.length,
    avgGoalsFor: average(matches.map((m) => m.goalsFor)),
    avgGoalsAgainst: average(matches.map((m) => m.goalsAgainst)),
    bttsPct: ratio(matches, (m) => m.goalsFor > 0 && m.goalsAgainst > 0),
  };
}

function toFormEntry(pm: PerspectiveMatch): FormEntry {
  const { match, venue, goalsFor, goalsAgainst } = pm;
  const opponent = venue === 'home' ? match.away.name : match.home.name;
  const outcome: FormEntry['outcome'] =
    goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';
  return {
    matchId: match.id,
    date: match.date,
    opponent,
    venue,
    goalsFor,
    goalsAgainst,
    btts: goalsFor > 0 && goalsAgainst > 0,
    outcome,
  };
}

/**
 * Compute the full statistics bundle for a team from its recent matches.
 * `matches` may be in any order; they are sorted by date (newest first).
 */
export function computeTeamStats(team: Team, matches: MatchResult[]): TeamStats {
  const perspectives = matches
    .map((m) => toPerspective(m, team.id))
    .filter((p): p is PerspectiveMatch => p !== null)
    .sort((a, b) => b.match.date.localeCompare(a.match.date));

  const last5 = perspectives.slice(0, 5);
  const last10 = perspectives.slice(0, 10);
  const homeMatches = perspectives.filter((p) => p.venue === 'home').slice(0, 10);
  const awayMatches = perspectives.filter((p) => p.venue === 'away').slice(0, 10);

  return {
    team,
    last5: computeWindow(last5),
    last10: computeWindow(last10),
    home: computeVenue(homeMatches),
    away: computeVenue(awayMatches),
    recentForm: last10.map(toFormEntry),
  };
}

/** Compute head-to-head stats from direct encounters between two teams. */
export function computeHeadToHead(
  homeId: string,
  awayId: string,
  matches: MatchResult[],
  limit = 10,
): HeadToHead {
  const direct = matches
    .filter(
      (m) =>
        (m.home.id === homeId && m.away.id === awayId) ||
        (m.home.id === awayId && m.away.id === homeId),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  return {
    matches: direct,
    played: direct.length,
    bttsPct: ratio(direct, (m) => m.homeGoals > 0 && m.awayGoals > 0),
    avgGoals: average(direct.map((m) => m.homeGoals + m.awayGoals)),
  };
}
