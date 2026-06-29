import { create } from 'zustand';
import type { PredictionTier } from '@/domain/types';
import { listHistory } from '@/data/cache/repositories';
import {
  evaluate,
  fitPlatt,
  IDENTITY_PLATT,
  type PlattParams,
  type Sample,
  type TierEval,
} from '@/core/backtest/backtest';

/** Minimum settled samples before auto-calibration actually adjusts anything. */
export const MIN_CALIBRATION_SAMPLES = 15;

/** Parse a "2-1" scoreline into [home, away] goals, or null when unparseable. */
function parseScore(score: string | undefined): [number, number] | null {
  if (!score) return null;
  const m = score.match(/(\d+)\s*[-x:]\s*(\d+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

interface CalibrationState {
  /** BTTS recalibration (Platt). */
  platt: PlattParams;
  sampleSize: number;
  overall: TierEval | null;
  byTier: TierEval[];
  ready: boolean; // enough samples to apply BTTS recalibration
  /** Over/Under 2.5 recalibration (Platt on the model's Over probability). */
  plattOu25: PlattParams;
  ou25SampleSize: number;
  ou25Ready: boolean;
  refresh: () => Promise<void>;
}

export const useCalibration = create<CalibrationState>((set) => ({
  platt: { ...IDENTITY_PLATT },
  sampleSize: 0,
  overall: null,
  byTier: [],
  ready: false,
  plattOu25: { ...IDENTITY_PLATT },
  ou25SampleSize: 0,
  ou25Ready: false,
  refresh: async () => {
    const records = await listHistory(2000);
    const settled = records.filter((r) => r.actual === 'yes' || r.actual === 'no');
    const samples: Sample[] = settled.map((r) => ({
      probYes: r.probYes,
      tier: r.tier as PredictionTier,
      outcome: r.actual === 'yes' ? 1 : 0,
    }));
    const ready = samples.length >= MIN_CALIBRATION_SAMPLES;
    const platt = ready
      ? fitPlatt(samples.map((s) => ({ probYes: s.probYes, outcome: s.outcome })))
      : { ...IDENTITY_PLATT };
    const { overall, byTier } = evaluate(samples);

    // Over/Under 2.5: fit on the stored model Over probability vs the real
    // over/under outcome (needs the Poisson markets + a final score).
    const ouSamples: Array<{ probYes: number; outcome: 0 | 1 }> = [];
    for (const r of records) {
      const goals = parseScore(r.actualScore);
      if (!goals || r.markets?.over25 == null) continue;
      ouSamples.push({
        probYes: r.markets.over25,
        outcome: goals[0] + goals[1] > 2.5 ? 1 : 0,
      });
    }
    const ou25Ready = ouSamples.length >= MIN_CALIBRATION_SAMPLES;
    const plattOu25 = ou25Ready ? fitPlatt(ouSamples) : { ...IDENTITY_PLATT };

    set({
      platt,
      sampleSize: samples.length,
      overall,
      byTier,
      ready,
      plattOu25,
      ou25SampleSize: ouSamples.length,
      ou25Ready,
    });
  },
}));
