import type { AnalysisBundle, DashboardRow, Fixture } from '@/domain/types';
import { DataService } from '@/data/DataService';
import { computeHeadToHead, computeTeamStats } from '@/core/statistics/statistics';
import { predict } from '@/core/prediction/engine';
import { calibrate, impliedBttsYes } from '@/core/prediction/calibration';
import { applyPlatt, IDENTITY_PLATT, type PlattParams } from '@/core/backtest/backtest';
import { tierForProbability } from '@/core/classification/classification';
import { clamp } from '@/lib/math';
import type { FactorKey } from '@/core/prediction/weights';
import { createLogger } from '@/services/logger';

const log = createLogger('analysisService');

export interface AnalysisOptions {
  weights?: Record<FactorKey, number>;
  /** Market-odds calibration weight (0..1); 0 = pure model. */
  oddsCalibration?: number;
  /** Auto-calibration mapping learned from settled history (Platt). */
  recalibration?: PlattParams;
}

/** Apply a learned Platt recalibration to the final probability (no-op for identity). */
function applyRecalibration(
  prediction: ReturnType<typeof calibrate>,
  params?: PlattParams,
): ReturnType<typeof calibrate> {
  if (!params || (params.a === IDENTITY_PLATT.a && params.b === IDENTITY_PLATT.b)) {
    return prediction;
  }
  const probYes = clamp(applyPlatt(prediction.probYes, params));
  const probNo = clamp(1 - probYes);
  return {
    ...prediction,
    probYes,
    probNo,
    tier: tierForProbability(Math.max(probYes, probNo)),
    recalibrated: true,
  };
}

/** Build the full analysis bundle for a single fixture. */
export async function buildAnalysis(
  data: DataService,
  fixture: Fixture,
  options: AnalysisOptions = {},
): Promise<AnalysisBundle> {
  const [homeMatches, awayMatches, h2hMatches] = await Promise.all([
    data.getTeamRecentMatches(fixture.home.id, 10),
    data.getTeamRecentMatches(fixture.away.id, 10),
    data.getHeadToHead(fixture.home.id, fixture.away.id, 10),
  ]);

  const homeStats = computeTeamStats(fixture.home, homeMatches);
  const awayStats = computeTeamStats(fixture.away, awayMatches);
  const h2h = computeHeadToHead(fixture.home.id, fixture.away.id, h2hMatches);
  const modelPrediction = predict({
    home: homeStats,
    away: awayStats,
    h2h,
    weights: options.weights,
  });
  const calibrated = calibrate(
    modelPrediction,
    impliedBttsYes(fixture.odds?.bttsYes, fixture.odds?.bttsNo),
    options.oddsCalibration ?? 0,
  );
  const prediction = applyRecalibration(calibrated, options.recalibration);

  return {
    fixture,
    homeStats,
    awayStats,
    h2h,
    prediction,
    generatedAt: new Date().toISOString(),
  };
}

/** Compute the prediction for a single fixture, returning a dashboard row.
 * Never throws — on failure the row carries `predictionError` and no prediction
 * so the fixture still appears in the dashboard. */
export async function buildDashboardRow(
  data: DataService,
  fixture: Fixture,
  options: AnalysisOptions = {},
): Promise<DashboardRow> {
  try {
    const bundle = await buildAnalysis(data, fixture, options);
    return { fixture, prediction: bundle.prediction };
  } catch (err) {
    log.warn('failed to build row', { fixture: fixture.id, err });
    return { fixture, predictionError: true };
  }
}

/** Sort rows by BTTS=YES probability (rows without a prediction go last). */
export function sortDashboardRows(rows: DashboardRow[]): DashboardRow[] {
  return [...rows].sort((a, b) => (b.prediction?.probYes ?? -1) - (a.prediction?.probYes ?? -1));
}

/** Build dashboard rows (fixture + prediction) for a list of fixtures. */
export async function buildDashboardRows(
  data: DataService,
  fixtures: Fixture[],
  options: AnalysisOptions = {},
): Promise<DashboardRow[]> {
  const rows = await Promise.all(
    fixtures.map((fixture) => buildDashboardRow(data, fixture, options)),
  );
  return sortDashboardRows(rows);
}
