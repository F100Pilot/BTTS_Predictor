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

interface CalibrationState {
  platt: PlattParams;
  sampleSize: number;
  overall: TierEval | null;
  byTier: TierEval[];
  ready: boolean; // enough samples to apply recalibration
  refresh: () => Promise<void>;
}

export const useCalibration = create<CalibrationState>((set) => ({
  platt: { ...IDENTITY_PLATT },
  sampleSize: 0,
  overall: null,
  byTier: [],
  ready: false,
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
    set({ platt, sampleSize: samples.length, overall, byTier, ready });
  },
}));
