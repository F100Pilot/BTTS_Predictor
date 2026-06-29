import type { BttsPrediction, MarketPrediction } from '@/domain/types';
import { cacheGet, cacheSet, cacheDelete } from '@/data/cache/cache';
import { normalizeWeights, type FactorKey } from '@/core/prediction/weights';
import type { PlattParams } from '@/core/backtest/backtest';

/** A cached analysis for one fixture: the BTTS prediction + Poisson markets. */
export interface SavedPrediction {
  prediction: BttsPrediction;
  markets?: MarketPrediction;
}

/** Persisted analysed predictions for one day, keyed by fixture id. */
interface DayCache {
  /** Signature of the settings used — invalidates the cache when they change. */
  sig: string;
  predictions: Record<string, SavedPrediction>;
}

const TTL = 1000 * 60 * 60 * 24 * 7; // keep a day's analysis for a week
const keyFor = (date: string): string => `dashboard:day:${date}`;

/**
 * Bumped whenever the model maths change so previously cached predictions are
 * recomputed instead of shown stale. (m2: recency-decay + Empirical-Bayes;
 * m3: tier classified on the rounded shown percentage;
 * m4: cache now also stores the Poisson markets for the market selector.)
 */
const MODEL_VERSION = 'm4';

/**
 * Signature of the inputs that affect a prediction. When the model version /
 * weights / odds calibration / auto-calibration change, the signature changes
 * and previously saved predictions are ignored (recomputed), keeping results
 * consistent.
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
  return `m=${MODEL_VERSION}|w=${wStr}|o=${oddsCalibration}|r=${r}`;
}

/** Load saved predictions for a day, but only if they match the current settings. */
export async function loadDayPredictions(
  date: string,
  sig: string,
): Promise<Record<string, SavedPrediction>> {
  const rec = await cacheGet<DayCache>(keyFor(date));
  if (!rec || rec.sig !== sig) return {};
  return rec.predictions ?? {};
}

/** Persist a single fixture's prediction (+ markets) into the day cache. */
export async function saveDayPrediction(
  date: string,
  sig: string,
  fixtureId: string,
  prediction: BttsPrediction,
  markets?: MarketPrediction,
): Promise<void> {
  const rec = await cacheGet<DayCache>(keyFor(date));
  const base: DayCache = rec && rec.sig === sig ? rec : { sig, predictions: {} };
  base.predictions[fixtureId] = { prediction, markets };
  await cacheSet(keyFor(date), base, TTL);
}

/** Drop a day's saved analysis (used by "Reanalisar"). */
export async function clearDayPredictions(date: string): Promise<void> {
  await cacheDelete(keyFor(date));
}
