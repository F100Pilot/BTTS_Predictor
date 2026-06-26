import type { BttsPrediction } from '@/domain/types';
import { clamp } from '@/lib/math';
import { tierForProbability } from '@/core/classification/classification';

/**
 * De-vigged market probability of BTTS=YES from bookmaker odds.
 * With both sides we remove the overround; with a single side we fall back to
 * the raw implied probability. Returns null when no usable odds are available.
 */
export function impliedBttsYes(oddYes?: number, oddNo?: number): number | null {
  const hasYes = typeof oddYes === 'number' && oddYes > 1;
  const hasNo = typeof oddNo === 'number' && oddNo > 1;
  if (hasYes && hasNo) {
    const py = 1 / oddYes!;
    const pn = 1 / oddNo!;
    return clamp(py / (py + pn));
  }
  if (hasYes) return clamp(1 / oddYes!);
  if (hasNo) return clamp(1 - 1 / oddNo!);
  return null;
}

/**
 * Blend the model probability with the market-implied probability.
 * `lambda` is the market weight (0 = pure model, 1 = pure market). The model
 * stays primary by design — calibration only nudges it toward the market.
 */
export function calibrate(
  prediction: BttsPrediction,
  impliedYes: number | null,
  lambda: number,
): BttsPrediction {
  const l = clamp(lambda);
  if (impliedYes == null || l <= 0) return prediction;

  const model = prediction.modelProbYes ?? prediction.probYes;
  const probYes = clamp((1 - l) * model + l * impliedYes);
  const probNo = clamp(1 - probYes);
  const dominant = Math.max(probYes, probNo);

  return {
    ...prediction,
    probYes,
    probNo,
    tier: prediction.insufficientData ? 'weak' : tierForProbability(dominant),
    modelProbYes: model,
    marketImpliedYes: impliedYes,
    calibrationApplied: l,
  };
}
