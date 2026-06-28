import type {
  AdjustedStats,
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
import { FORM_HALF_LIFE_DAYS, LEAGUE_PRIORS, PRIOR_STRENGTH } from '@/core/prediction/constants';

interface PerspectiveMatch {
  match: MatchResult;
  venue: Venue;
  goalsFor: number;
  goalsAgainst: number;
}

const MS_PER_DAY = 86_400_000;

/** Options enabling recency-decay + Empirical-Bayes shrinkage of the windows. */
export interface AdjustOptions {
  /** Reference "now" (ms) the match ages are measured against. */
  now?: number;
  /** Recency half-life in days. */
  halfLifeDays?: number;
  /** Pseudo-match count of the league prior mixed into each rate. */
  priorStrength?: number;
}

/** Exponential recency weight per match: 0.5^(ageDays / halfLife). */
function decayWeights(matches: PerspectiveMatch[], now: number, halfLifeDays: number): number[] {
  return matches.map((m) => {
    const ageDays = Math.max(0, (now - Date.parse(m.match.date)) / MS_PER_DAY);
    return Math.pow(0.5, ageDays / halfLifeDays);
  });
}

/** Weighted mean of `values` by `weights` (0 when there is no weight at all). */
function weightedMean(values: number[], weights: number[]): number {
  const sw = weights.reduce((s, w) => s + w, 0);
  if (sw === 0) return 0;
  return values.reduce((s, v, i) => s + v * (weights[i] ?? 0), 0) / sw;
}

/** Empirical-Bayes shrink toward a prior: (n·value + k·prior) / (n + k). */
function shrink(value: number, prior: number, n: number, k: number): number {
  return (n * value + k * prior) / (n + k);
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

/** Decay-weighted + shrunk window stats (raw counts kept, rates regularized). */
function computeAdjustedWindow(
  matches: PerspectiveMatch[],
  o: Required<AdjustOptions>,
): WindowStats {
  if (matches.length === 0) return { ...EMPTY_WINDOW };
  const w = decayWeights(matches, o.now, o.halfLifeDays);
  const n = matches.length;
  const k = o.priorStrength;
  const gf = matches.map((m) => m.goalsFor);
  const ga = matches.map((m) => m.goalsAgainst);
  const btts = matches.map((m) => (m.goalsFor > 0 && m.goalsAgainst > 0 ? 1 : 0));
  const over = matches.map((m) => (m.goalsFor + m.goalsAgainst > 2.5 ? 1 : 0));
  const cs = matches.map((m) => (m.goalsAgainst === 0 ? 1 : 0));
  const fts = matches.map((m) => (m.goalsFor === 0 ? 1 : 0));
  return {
    played: n,
    goalsFor: gf.reduce((s, v) => s + v, 0),
    goalsAgainst: ga.reduce((s, v) => s + v, 0),
    avgGoalsFor: shrink(weightedMean(gf, w), LEAGUE_PRIORS.avgGoalsFor, n, k),
    avgGoalsAgainst: shrink(weightedMean(ga, w), LEAGUE_PRIORS.avgGoalsAgainst, n, k),
    bttsPct: shrink(weightedMean(btts, w), LEAGUE_PRIORS.bttsPct, n, k),
    over25Pct: shrink(weightedMean(over, w), LEAGUE_PRIORS.over25Pct, n, k),
    cleanSheetPct: shrink(weightedMean(cs, w), LEAGUE_PRIORS.cleanSheetPct, n, k),
    failedToScorePct: shrink(weightedMean(fts, w), LEAGUE_PRIORS.failedToScorePct, n, k),
  };
}

/** Decay-weighted + shrunk venue stats. */
function computeAdjustedVenue(matches: PerspectiveMatch[], o: Required<AdjustOptions>): VenueStats {
  const n = matches.length;
  if (n === 0) return { played: 0, avgGoalsFor: 0, avgGoalsAgainst: 0, bttsPct: 0 };
  const w = decayWeights(matches, o.now, o.halfLifeDays);
  const k = o.priorStrength;
  const gf = matches.map((m) => m.goalsFor);
  const ga = matches.map((m) => m.goalsAgainst);
  const btts = matches.map((m) => (m.goalsFor > 0 && m.goalsAgainst > 0 ? 1 : 0));
  return {
    played: n,
    avgGoalsFor: shrink(weightedMean(gf, w), LEAGUE_PRIORS.avgGoalsFor, n, k),
    avgGoalsAgainst: shrink(weightedMean(ga, w), LEAGUE_PRIORS.avgGoalsAgainst, n, k),
    bttsPct: shrink(weightedMean(btts, w), LEAGUE_PRIORS.bttsPct, n, k),
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
 *
 * When `adjust` options are passed, an extra `adjusted` bundle is attached with
 * recency-decayed + league-shrunk windows for the prediction engine; the raw
 * windows are always left untouched for display.
 */
export function computeTeamStats(
  team: Team,
  matches: MatchResult[],
  adjust?: AdjustOptions,
): TeamStats {
  const perspectives = matches
    .map((m) => toPerspective(m, team.id))
    .filter((p): p is PerspectiveMatch => p !== null)
    .sort((a, b) => b.match.date.localeCompare(a.match.date));

  const last5 = perspectives.slice(0, 5);
  const last10 = perspectives.slice(0, 10);
  const homeMatches = perspectives.filter((p) => p.venue === 'home').slice(0, 10);
  const awayMatches = perspectives.filter((p) => p.venue === 'away').slice(0, 10);

  const stats: TeamStats = {
    team,
    last5: computeWindow(last5),
    last10: computeWindow(last10),
    home: computeVenue(homeMatches),
    away: computeVenue(awayMatches),
    recentForm: last10.map(toFormEntry),
  };

  if (adjust) {
    const o: Required<AdjustOptions> = {
      now: adjust.now ?? Date.now(),
      halfLifeDays: adjust.halfLifeDays ?? FORM_HALF_LIFE_DAYS,
      priorStrength: adjust.priorStrength ?? PRIOR_STRENGTH,
    };
    const adjusted: AdjustedStats = {
      last5: computeAdjustedWindow(last5, o),
      last10: computeAdjustedWindow(last10, o),
      home: computeAdjustedVenue(homeMatches, o),
      away: computeAdjustedVenue(awayMatches, o),
    };
    stats.adjusted = adjusted;
  }

  return stats;
}

/** Compute head-to-head stats from direct encounters between two teams.
 *
 * With `adjust` options, an extra `bttsPctWeighted` is attached: the BTTS rate
 * recency-weighted (older meetings count less) and shrunk toward the league
 * prior for small samples. The raw `bttsPct` is left untouched for display. */
export function computeHeadToHead(
  homeId: string,
  awayId: string,
  matches: MatchResult[],
  limit = 10,
  adjust?: AdjustOptions,
): HeadToHead {
  const direct = matches
    .filter(
      (m) =>
        (m.home.id === homeId && m.away.id === awayId) ||
        (m.home.id === awayId && m.away.id === homeId),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  const h2h: HeadToHead = {
    matches: direct,
    played: direct.length,
    bttsPct: ratio(direct, (m) => m.homeGoals > 0 && m.awayGoals > 0),
    avgGoals: average(direct.map((m) => m.homeGoals + m.awayGoals)),
  };

  if (adjust && direct.length > 0) {
    const now = adjust.now ?? Date.now();
    const halfLifeDays = adjust.halfLifeDays ?? FORM_HALF_LIFE_DAYS;
    const k = adjust.priorStrength ?? PRIOR_STRENGTH;
    const weights = direct.map((m) => {
      const ageDays = Math.max(0, (now - Date.parse(m.date)) / MS_PER_DAY);
      return Math.pow(0.5, ageDays / halfLifeDays);
    });
    const btts = direct.map((m) => (m.homeGoals > 0 && m.awayGoals > 0 ? 1 : 0));
    h2h.bttsPctWeighted = shrink(
      weightedMean(btts, weights),
      LEAGUE_PRIORS.bttsPct,
      direct.length,
      k,
    );
  }

  return h2h;
}
