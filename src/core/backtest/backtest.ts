import type { PredictionTier } from '@/domain/types';
import { clamp, round, safeDivide } from '@/lib/math';

export interface Sample {
  probYes: number; // predicted probability of BTTS=YES (0..1)
  tier: PredictionTier;
  outcome: 0 | 1; // 1 = BTTS happened, 0 = it did not
}

export interface TierEval {
  tier: PredictionTier | 'all';
  n: number;
  accuracy: number; // % of correct dominant-side calls
  brier: number; // mean squared error of probYes vs outcome (lower better)
  avgPredicted: number; // mean predicted P(YES)
  actualRate: number; // observed rate of BTTS=YES
}

/** Brier score for one prediction. */
export function brier(probYes: number, outcome: 0 | 1): number {
  return (probYes - outcome) ** 2;
}

/** Whether the dominant side of the prediction matched the outcome. */
export function isCorrect(probYes: number, outcome: 0 | 1): boolean {
  return (probYes >= 0.5 ? 1 : 0) === outcome;
}

function evalGroup(tier: TierEval['tier'], samples: Sample[]): TierEval {
  const n = samples.length;
  const correct = samples.filter((s) => isCorrect(s.probYes, s.outcome)).length;
  const brierSum = samples.reduce((sum, s) => sum + brier(s.probYes, s.outcome), 0);
  const predictedSum = samples.reduce((sum, s) => sum + s.probYes, 0);
  const yesCount = samples.filter((s) => s.outcome === 1).length;
  return {
    tier,
    n,
    accuracy: round(safeDivide(correct, n, 0) * 100, 1),
    brier: round(safeDivide(brierSum, n, 0), 4),
    avgPredicted: round(safeDivide(predictedSum, n, 0) * 100, 1),
    actualRate: round(safeDivide(yesCount, n, 0) * 100, 1),
  };
}

const TIER_ORDER: PredictionTier[] = ['very-strong', 'strong', 'medium', 'weak'];

/** Overall + per-tier evaluation of a set of settled predictions. */
export function evaluate(samples: Sample[]): { overall: TierEval; byTier: TierEval[] } {
  return {
    overall: evalGroup('all', samples),
    byTier: TIER_ORDER.map((tier) =>
      evalGroup(
        tier,
        samples.filter((s) => s.tier === tier),
      ),
    ).filter((e) => e.n > 0),
  };
}

export interface ReliabilityBin {
  /** Bin center as a percentage (x-axis). */
  predicted: number;
  /** Observed BTTS=YES rate in this bin, as a percentage (y-axis), or null if empty. */
  actual: number | null;
  n: number;
}

/**
 * Reliability (calibration) curve: bucket predictions by predicted probability
 * and compare the bucket's mean predicted prob with the observed outcome rate.
 * A well-calibrated model sits near the diagonal (predicted ≈ actual).
 */
export function reliabilityCurve(samples: Sample[], bins = 5): ReliabilityBin[] {
  const buckets: Sample[][] = Array.from({ length: bins }, () => []);
  for (const s of samples) {
    const idx = Math.min(bins - 1, Math.floor(clamp(s.probYes) * bins));
    buckets[idx]!.push(s);
  }
  return buckets.map((bucket, i) => {
    const center = ((i + 0.5) / bins) * 100;
    if (bucket.length === 0) return { predicted: round(center, 0), actual: null, n: 0 };
    const yes = bucket.filter((s) => s.outcome === 1).length;
    return {
      predicted: round(center, 0),
      actual: round((yes / bucket.length) * 100, 1),
      n: bucket.length,
    };
  });
}

export interface ConfidenceBand {
  /** e.g. "70–80%". */
  label: string;
  lower: number; // inclusive lower bound (50..90)
  upper: number; // upper bound (60..100)
  n: number;
  /** % of calls that were correct in this band, or null when empty. */
  accuracy: number | null;
}

/**
 * Hit-rate of the model grouped by the *shown* prediction percentage — the
 * dominant side, which always sits in 50–100%. Answers "which confidence
 * bands actually hit most often". `bandSize` is the width of each band (default
 * 10 → 50–60, 60–70, …, 90–100).
 */
export function accuracyByConfidence(samples: Sample[], bandSize = 10): ConfidenceBand[] {
  const bands: ConfidenceBand[] = [];
  for (let lo = 50; lo < 100; lo += bandSize) {
    const hi = Math.min(100, lo + bandSize);
    const inBand = samples.filter((s) => {
      const pct = Math.max(s.probYes, 1 - s.probYes) * 100;
      // The top band is closed on the right so a 100% call is counted.
      return pct >= lo && (hi >= 100 ? pct <= hi : pct < hi);
    });
    const correct = inBand.filter((s) => isCorrect(s.probYes, s.outcome)).length;
    bands.push({
      label: `${lo}–${hi}%`,
      lower: lo,
      upper: hi,
      n: inBand.length,
      accuracy: inBand.length ? round((correct / inBand.length) * 100, 1) : null,
    });
  }
  return bands;
}

// ---- Platt scaling (logistic recalibration) ----

export interface PlattParams {
  a: number; // slope on the logit
  b: number; // bias
}

export const IDENTITY_PLATT: PlattParams = { a: 1, b: 0 };

const EPS = 1e-6;
function logit(p: number): number {
  const x = clamp(p, EPS, 1 - EPS);
  return Math.log(x / (1 - x));
}
function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** Apply a fitted Platt mapping to a probability. */
export function applyPlatt(probYes: number, params: PlattParams): number {
  return clamp(sigmoid(params.a * logit(probYes) + params.b));
}

/**
 * Fit Platt scaling (a, b) by gradient descent on log-loss, mapping the model's
 * predicted probability to the observed outcome. Corrects systematic over/under
 * confidence learned from the user's settled history.
 */
export function fitPlatt(
  samples: Array<{ probYes: number; outcome: 0 | 1 }>,
  { iterations = 400, lr = 0.1 }: { iterations?: number; lr?: number } = {},
): PlattParams {
  if (samples.length < 2) return { ...IDENTITY_PLATT };
  const xs = samples.map((s) => logit(s.probYes));
  let a = 1;
  let b = 0;
  for (let it = 0; it < iterations; it++) {
    let ga = 0;
    let gb = 0;
    for (let i = 0; i < xs.length; i++) {
      const pred = sigmoid(a * xs[i]! + b);
      const err = pred - samples[i]!.outcome;
      ga += err * xs[i]!;
      gb += err;
    }
    a -= (lr * ga) / xs.length;
    b -= (lr * gb) / xs.length;
  }
  return { a: round(a, 4), b: round(b, 4) };
}
