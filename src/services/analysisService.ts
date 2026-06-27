import type { AnalysisBundle, DashboardRow, Fixture } from '@/domain/types';
import { DataService } from '@/data/DataService';
import { computeHeadToHead, computeTeamStats } from '@/core/statistics/statistics';
import { predict } from '@/core/prediction/engine';
import { predictMarkets } from '@/core/prediction/markets';
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
  /** Throw on a provider data error (e.g. 429) instead of treating it as empty.
   * Lets the dashboard tell a rate-limit failure apart from genuine no-data. */
  throwOnDataError?: boolean;
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
    tier: prediction.insufficientData ? 'weak' : tierForProbability(Math.max(probYes, probNo)),
    recalibrated: true,
  };
}

/** Build the full analysis bundle for a single fixture. */
export async function buildAnalysis(
  data: DataService,
  fixture: Fixture,
  options: AnalysisOptions = {},
): Promise<AnalysisBundle> {
  const t = options.throwOnDataError ?? false;
  // Fetch each team's recent matches once (15 to give the windows + H2H enough
  // data). H2H is derived locally from those instead of a 3rd API call — this
  // cuts the per-fixture cost from 3 requests to 2 and avoids double-fetching.
  const [homeMatches, awayMatches] = await Promise.all([
    data.getTeamRecentMatches(fixture.home.id, 15, t),
    data.getTeamRecentMatches(fixture.away.id, 15, t),
  ]);

  let homeStats = computeTeamStats(fixture.home, homeMatches);
  let awayStats = computeTeamStats(fixture.away, awayMatches);

  // When recent history is thin (< 3 games — happens for national teams early
  // in a tournament), enrich with season-wide stats from the provider.
  // Only fetched when needed to spare API quota.
  const leagueId = fixture.competition.id;
  const season = fixture.date.substring(0, 4);
  const needsHome = homeStats.last10.played < 3;
  const needsAway = awayStats.last10.played < 3;
  if ((needsHome || needsAway) && leagueId !== 'unknown') {
    const [homeSeason, awaySeason] = await Promise.all([
      needsHome ? data.getTeamSeasonStats(fixture.home.id, leagueId, season) : null,
      needsAway ? data.getTeamSeasonStats(fixture.away.id, leagueId, season) : null,
    ]);
    if (homeSeason) homeStats = { ...homeStats, seasonStats: homeSeason };
    if (awaySeason) awayStats = { ...awayStats, seasonStats: awaySeason };
  }

  // Direct encounters appear in both teams' histories; dedupe by match id.
  const h2hPool = Array.from(
    new Map([...homeMatches, ...awayMatches].map((m) => [m.id, m])).values(),
  );
  const h2h = computeHeadToHead(fixture.home.id, fixture.away.id, h2hPool);
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
  const markets = predictMarkets(homeStats, awayStats);

  return {
    fixture,
    homeStats,
    awayStats,
    h2h,
    prediction,
    markets,
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
    // Surface provider errors (e.g. 429) so a rate-limited game becomes a
    // predictionError (retried later) rather than a cached "no data" verdict.
    const bundle = await buildAnalysis(data, fixture, { ...options, throwOnDataError: true });
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
