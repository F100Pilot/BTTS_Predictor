import type { BttsPrediction, HeadToHead, PredictionFactor, TeamStats } from '@/domain/types';
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

/**
 * FORM (30%): Poisson-based probability that BOTH teams score, using recent
 * attacking output vs the opponent's recent defensive frailty (last 5).
 * Neutral when either team has no recent matches (avoids fabricating 0%).
 */
function formScore(home: TeamStats, away: TeamStats): number {
  if (home.last5.played === 0 || away.last5.played === 0) return NEUTRAL;
  const lambdaHome = (home.last5.avgGoalsFor + away.last5.avgGoalsAgainst) / 2;
  const lambdaAway = (away.last5.avgGoalsFor + home.last5.avgGoalsAgainst) / 2;
  return clamp(probScores(lambdaHome) * probScores(lambdaAway));
}

/** BTTS HISTORY (25%): mean of both teams' BTTS rate over the last 10. */
function bttsHistoryScore(home: TeamStats, away: TeamStats): number {
  if (home.last10.played === 0 || away.last10.played === 0) return NEUTRAL;
  return clamp((home.last10.bttsPct + away.last10.bttsPct) / 2);
}

/** ATTACK (15%): how reliably each team scores, averaged. */
function attackScore(home: TeamStats, away: TeamStats): number {
  if (home.last10.played === 0 || away.last10.played === 0) return NEUTRAL;
  return clamp(average([probScores(home.last10.avgGoalsFor), probScores(away.last10.avgGoalsFor)]));
}

/** DEFENSE (15%): how reliably each team concedes (weak defense ⇒ BTTS). */
function defenseScore(home: TeamStats, away: TeamStats): number {
  if (home.last10.played === 0 || away.last10.played === 0) return NEUTRAL;
  return clamp(
    average([probScores(home.last10.avgGoalsAgainst), probScores(away.last10.avgGoalsAgainst)]),
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
  const dataScore = clamp(
    average([
      Math.min(home.last10.played, idealMatches) / idealMatches,
      Math.min(away.last10.played, idealMatches) / idealMatches,
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

  // Too few matches to trust the model — never show a "strong" tier on thin air.
  const insufficientData = home.last10.played < 3 || away.last10.played < 3;

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
