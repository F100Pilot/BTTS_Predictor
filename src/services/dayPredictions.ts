import type { BttsPrediction } from '@/domain/types';
import { cacheGet, cacheSet, cacheDelete } from '@/data/cache/cache';
import { normalizeWeights, type FactorKey } from '@/core/prediction/weights';
import type { PlattParams } from '@/core/backtest/backtest';

/** Persisted analysed predictions for one day, keyed by fixture id. */
interface DayCache {
  /** Signature of the settings used — invalidates the cache when they change. */
  sig: string;
  predictions: Record<string, BttsPrediction>;
}

const TTL = 1000 * 60 * 60 * 24 * 7; // keep a day's analysis for a week
const keyFor = (date: string): string => `dashboard:day:${date}`;

/**
 * Signature of the inputs that affect a prediction. When weights / odds
 * calibration / auto-calibration change, the signature changes and previously
 * saved predictions are ignored (recomputed), keeping results consistent.
 */
export function predictionSignature(
  weights: Record<FactorKey, number>,
  oddsCalibration: number,
  recalibration?: PlattParams,
): string {
  const w = normalizeWeights(weights);
  const wStr = (Object.keys(w) as FactorKey[])
    .sort()
    .map((k) => `${k}:${w[k].toFixed(3)}`)
    .join(',');
  const r = recalibration ? `${recalibration.a.toFixed(3)},${recalibration.b.toFixed(3)}` : 'none';
  return `w=${wStr}|o=${oddsCalibration}|r=${r}`;
}

/** Load saved predictions for a day, but only if they match the current settings. */
export async function loadDayPredictions(
  date: string,
  sig: string,
): Promise<Record<string, BttsPrediction>> {
  const rec = await cacheGet<DayCache>(keyFor(date));
  if (!rec || rec.sig !== sig) return {};
  return rec.predictions ?? {};
}

/** Persist a single fixture's prediction into the day cache (read-modify-write). */
export async function saveDayPrediction(
  date: string,
  sig: string,
  fixtureId: string,
  prediction: BttsPrediction,
): Promise<void> {
  const rec = await cacheGet<DayCache>(keyFor(date));
  const base: DayCache = rec && rec.sig === sig ? rec : { sig, predictions: {} };
  base.predictions[fixtureId] = prediction;
  await cacheSet(keyFor(date), base, TTL);
}

/** Drop a day's saved analysis (used by "Reanalisar"). */
export async function clearDayPredictions(date: string): Promise<void> {
  await cacheDelete(keyFor(date));
}
