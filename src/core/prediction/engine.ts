import type {
  BttsPrediction,
  HeadToHead,
  PredictionFactor,
  TeamStats,
  VenueStats,
  WindowStats,
} from '@/domain/types';
import { clamp, average, stdDev, round } from '@/lib/math';
import { tierForProbability } from '@/core/classification/classification';
import { DEFAULT_WEIGHTS, FACTOR_LABELS, normalizeWeights, type FactorKey } from './weights';

export interface PredictInput {
  home: TeamStats;
  away: TeamStats;
  h2h: HeadToHead;
  weights?: Record<FactorKey, number>;
}

/** Probability a team scores at least one goal given expected goals (Poisson). */
function probScores(expectedGoals: number): number {
  return 1 - Math.exp(-Math.max(0, expectedGoals));
}

/** Neutral score used when a factor has no underlying data ("don't know"). */
const NEUTRAL = 0.5;
/** Minimum matches before a factor is trusted (else season stats or NEUTRAL). */
const MIN_MATCHES = 3;
/** Mild home-scoring boost applied to the home team's expected goals. */
const HOME_ADVANTAGE = 1.05;

/** Average goals-for, preferring venue-specific data when it has enough games. */
function venueGoalsFor(venue: VenueStats, fallback: WindowStats): number {
  return venue.played >= MIN_MATCHES ? venue.avgGoalsFor : fallback.avgGoalsFor;
}
/** Average goals-against, preferring venue-specific data when it has enough games. */
function venueGoalsAgainst(venue: VenueStats, fallback: WindowStats): number {
  return venue.played >= MIN_MATCHES ? venue.avgGoalsAgainst : fallback.avgGoalsAgainst;
}

/**
 * A team has "sufficient data" when either recent match history or season-wide
 * stats are available. Season stats (API-Football /teams/statistics) are used
 * as a fallback for national teams with thin recent history.
 */
function hasSufficientData(stats: TeamStats): boolean {
  return (
    stats.last10.played >= MIN_MATCHES ||
    (stats.seasonStats != null && stats.seasonStats.played >= MIN_MATCHES)
  );
}

/** Expected goals-for at a given venue. Prefers recent history, falls back to season stats. */
function effectiveGoalsFor(stats: TeamStats, venue: 'home' | 'away'): number {
  if (stats.last10.played >= MIN_MATCHES) {
    return venue === 'home'
      ? venueGoalsFor(stats.home, stats.last5)
      : venueGoalsFor(stats.away, stats.last5);
  }
  if (stats.seasonStats) {
    return venue === 'home'
      ? stats.seasonStats.avgGoalsForHome
      : stats.seasonStats.avgGoalsForAway;
  }
  // Use whatever little recent data we have (0–2 games)
  const vStats = venue === 'home' ? stats.home : stats.away;
  return vStats.played > 0 ? vStats.avgGoalsFor : stats.last5.avgGoalsFor;
}

/** Expected goals-against at a given venue. Prefers recent history, falls back to season stats. */
function effectiveGoalsAgainst(stats: TeamStats, venue: 'home' | 'away'): number {
  if (stats.last10.played >= MIN_MATCHES) {
    return venue === 'home'
      ? venueGoalsAgainst(stats.home, stats.last5)
      : venueGoalsAgainst(stats.away, stats.last5);
  }
  if (stats.seasonStats) {
    return venue === 'home'
      ? stats.seasonStats.avgGoalsAgainstHome
      : stats.seasonStats.avgGoalsAgainstAway;
  }
  const vStats = venue === 'home' ? stats.home : stats.away;
  return vStats.played > 0 ? vStats.avgGoalsAgainst : stats.last5.avgGoalsAgainst;
}

/** Overall avg goals-for. Prefers recent last10, falls back to season stats. */
function effectiveAvgGoalsFor(stats: TeamStats): number {
  if (stats.last10.played >= MIN_MATCHES) return stats.last10.avgGoalsFor;
  if (stats.seasonStats) return stats.seasonStats.avgGoalsFor;
  return stats.last10.avgGoalsFor;
}

/** Overall avg goals-against. Prefers recent last10, falls back to season stats. */
function effectiveAvgGoalsAgainst(stats: TeamStats): number {
  if (stats.last10.played >= MIN_MATCHES) return stats.last10.avgGoalsAgainst;
  if (stats.seasonStats) return stats.seasonStats.avgGoalsAgainst;
  return stats.last10.avgGoalsAgainst;
}

/**
 * Team's BTTS rate. For season stats, approximated via independence:
 * P(BTTS) ≈ P(scores) × P(concedes) = (1 − failToScore%) × (1 − cleanSheet%).
 */
function effectiveBttsPct(stats: TeamStats): number {
  if (stats.last10.played >= MIN_MATCHES) return stats.last10.bttsPct;
  if (stats.seasonStats) {
    const pScores = 1 - stats.seasonStats.failedToScorePct;
    const pConcedes = 1 - stats.seasonStats.cleanSheetPct;
    return clamp(pScores * pConcedes);
  }
  return stats.last10.bttsPct;
}

/**
 * FORM (30%): Poisson probability that BOTH teams score. Expected goals are
 * built venue-aware — the home team's HOME attack vs the away team's AWAY
 * defence (and vice-versa), with a mild home advantage. Falls back to season
 * stats for teams with little recent history (e.g. national teams in a
 * tournament). Returns NEUTRAL only when no data at all is available.
 */
function formScore(home: TeamStats, away: TeamStats): number {
  if (!hasSufficientData(home) || !hasSufficientData(away)) return NEUTRAL;
  const lambdaHome =
    ((effectiveGoalsFor(home, 'home') + effectiveGoalsAgainst(away, 'away')) / 2) * HOME_ADVANTAGE;
  const lambdaAway =
    (effectiveGoalsFor(away, 'away') + effectiveGoalsAgainst(home, 'home')) / 2;
  return clamp(probScores(lambdaHome) * probScores(lambdaAway));
}

/** BTTS HISTORY (25%): mean of both teams' BTTS rate. Uses season stats as fallback. */
function bttsHistoryScore(home: TeamStats, away: TeamStats): number {
  if (!hasSufficientData(home) || !hasSufficientData(away)) return NEUTRAL;
  return clamp((effectiveBttsPct(home) + effectiveBttsPct(away)) / 2);
}

/** ATTACK (15%): how reliably each team scores, averaged. */
function attackScore(home: TeamStats, away: TeamStats): number {
  if (!hasSufficientData(home) || !hasSufficientData(away)) return NEUTRAL;
  return clamp(
    average([probScores(effectiveAvgGoalsFor(home)), probScores(effectiveAvgGoalsFor(away))]),
  );
}

/** DEFENSE (15%): how reliably each team concedes (weak defense ⇒ BTTS). */
function defenseScore(home: TeamStats, away: TeamStats): number {
  if (!hasSufficientData(home) || !hasSufficientData(away)) return NEUTRAL;
  return clamp(
    average([
      probScores(effectiveAvgGoalsAgainst(home)),
      probScores(effectiveAvgGoalsAgainst(away)),
    ]),
  );
}

/** H2H (10%): direct-encounter BTTS rate; neutral when no history. */
function h2hScore(h2h: HeadToHead): number {
  if (h2h.played === 0) return 0.5;
  return clamp(h2h.bttsPct);
}

/** VENUE (5%): home team's home BTTS rate vs away team's away BTTS rate. */
function venueScore(home: TeamStats, away: TeamStats): number {
  const parts: number[] = [];
  if (home.home.played > 0) parts.push(home.home.bttsPct);
  if (away.away.played > 0) parts.push(away.away.bttsPct);
  if (parts.length === 0) return 0.5;
  return clamp(average(parts));
}

/**
 * Confidence (0..10) blends:
 *  - data sufficiency (enough matches available),
 *  - factor agreement (low spread between sub-scores),
 *  - extremity (probability far from the 50/50 coin flip).
 */
function computeConfidence(
  factors: PredictionFactor[],
  probYes: number,
  home: TeamStats,
  away: TeamStats,
  h2h: HeadToHead,
): number {
  const idealMatches = 10;
  // Use the larger of recent-match count and season-stats count as the measure
  // of how well-supported each team's stats are.
  const homePlayed = Math.max(home.last10.played, home.seasonStats?.played ?? 0);
  const awayPlayed = Math.max(away.last10.played, away.seasonStats?.played ?? 0);
  const dataScore = clamp(
    average([
      Math.min(homePlayed, idealMatches) / idealMatches,
      Math.min(awayPlayed, idealMatches) / idealMatches,
      Math.min(h2h.played, 4) / 4,
    ]),
  );

  // Agreement: 1 - spread of factor scores (0 spread ⇒ full agreement).
  const spread = stdDev(factors.map((f) => f.score));
  const agreementScore = clamp(1 - spread * 2);

  // Extremity: distance from 0.5, scaled to 0..1.
  const extremeScore = clamp(Math.abs(probYes - 0.5) * 2);

  const blended = 0.45 * dataScore + 0.3 * agreementScore + 0.25 * extremeScore;
  return round(clamp(blended) * 10, 1);
}

/** Pure prediction function — no side effects. */
export function predict(input: PredictInput): BttsPrediction {
  const { home, away, h2h } = input;
  const weights = normalizeWeights(input.weights ?? DEFAULT_WEIGHTS);

  const rawScores: Record<FactorKey, number> = {
    form: formScore(home, away),
    bttsHistory: bttsHistoryScore(home, away),
    attack: attackScore(home, away),
    defense: defenseScore(home, away),
    h2h: h2hScore(h2h),
    venue: venueScore(home, away),
  };

  const factors: PredictionFactor[] = (Object.keys(rawScores) as FactorKey[]).map((key) => {
    const weight = weights[key];
    const score = rawScores[key];
    return {
      key,
      label: FACTOR_LABELS[key],
      weight,
      score,
      contribution: weight * score,
    };
  });

  const probYes = clamp(factors.reduce((sum, f) => sum + f.contribution, 0));
  const probNo = clamp(1 - probYes);
  const dominant = Math.max(probYes, probNo);

  // A game is "insufficient" only when neither recent history nor season stats
  // provide enough data for either team to trust the prediction.
  const insufficientData = !hasSufficientData(home) || !hasSufficientData(away);

  return {
    probYes,
    probNo,
    confidence: computeConfidence(factors, probYes, home, away, h2h),
    tier: insufficientData ? 'weak' : tierForProbability(dominant),
    factors,
    modelProbYes: probYes,
    insufficientData,
  };
}
