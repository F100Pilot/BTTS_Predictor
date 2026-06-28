import { listHistory } from '@/data/cache/repositories';
import { tuneWeights, type TuneSample } from '@/core/backtest/tuneWeights';
import type { FactorKey } from '@/core/prediction/weights';
import { useSettings } from '@/store/settingsStore';
import { createLogger } from './logger';

const log = createLogger('autoTune');

/** Need at least this many settled predictions (with factor scores) to re-tune. */
const MIN_SAMPLES = 20;
/** Only apply when some weight moves at least this much (avoids churn). */
const MIN_DELTA = 0.02;

/**
 * When auto-calibration is on and there's enough settled history, re-optimize
 * the model weights from results and apply them — remembering the previous set
 * (so the sliders can show the red "before" markers). No-op otherwise. Safe to
 * call repeatedly: it converges (re-tuning already-tuned weights barely moves
 * them, falling below MIN_DELTA).
 */
export async function maybeAutoTuneWeights(): Promise<void> {
  const settings = useSettings.getState();
  if (!settings.autoCalibrate) return;
  try {
    const records = await listHistory(2000);
    const samples: TuneSample[] = records
      .filter((r) => (r.actual === 'yes' || r.actual === 'no') && r.factorScores)
      .map((r) => ({
        scores: r.factorScores as TuneSample['scores'],
        outcome: r.actual === 'yes' ? 1 : 0,
      }));
    if (samples.length < MIN_SAMPLES) return;

    const result = tuneWeights(samples, settings.weights);
    const keys = Object.keys(result.weights) as FactorKey[];
    const maxDelta = Math.max(
      ...keys.map((k) => Math.abs((result.weights[k] ?? 0) - (settings.weights[k] ?? 0))),
    );
    if (maxDelta < MIN_DELTA) return;

    useSettings.getState().applyWeights(result.weights);
    log.info('auto-tuned weights applied', { maxDelta, n: result.n });
  } catch (err) {
    log.warn('auto-tune failed', err);
  }
}
