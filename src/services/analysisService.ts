import type { AnalysisBundle, DashboardRow, Fixture } from '@/domain/types';
import { DataService } from '@/data/DataService';
import { computeHeadToHead, computeTeamStats } from '@/core/statistics/statistics';
import { predict } from '@/core/prediction/engine';
import { predictMarkets } from '@/core/prediction/markets';
import { calibrate, impliedBttsYes } from '@/core/prediction/calibration';
import { applyPlatt, IDENTITY_PLATT, type PlattParams } from '@/core/backtest/backtest';
import { tierForProbability } from '@/core/classification/classification';
import { clamp, round } from '@/lib/math';
import type { MarketPrediction } from '@/domain/types';
import { MAX_RECENT_MATCHES } from '@/core/prediction/constants';
import type { FactorKey } from '@/core/prediction/weights';
import { marketPick, type MarketKey } from '@/core/markets/markets';
import { createLogger } from '@/services/logger';

const log = createLogger('analysisService');

export interface AnalysisOptions {
  weights?: Record<FactorKey, number>;
  /** Market-odds calibration weight (0..1); 0 = pure model. */
  oddsCalibration?: number;
  /** Auto-calibration mapping learned from settled history (Platt) for BTTS. */
  recalibration?: PlattParams;
  /** Auto-calibration mapping for the Over/Under 2.5 market (Platt on Over). */
  ou25Recalibration?: PlattParams;
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

/** Apply a learned Over/Under 2.5 recalibration to the Poisson markets (no-op for identity). */
function applyMarketRecalibration(
  markets: MarketPrediction,
  params?: PlattParams,
): MarketPrediction {
  if (!params || (params.a === IDENTITY_PLATT.a && params.b === IDENTITY_PLATT.b)) return markets;
  const over25 = round(clamp(applyPlatt(markets.over25, params)), 4);
  return { ...markets, over25, under25: round(1 - over25, 4) };
}

/** Build the full analysis bundle for a single fixture. */
export async function buildAnalysis(
  data: DataService,
  fixture: Fixture,
  options: AnalysisOptions = {},
): Promise<AnalysisBundle> {
  const t = options.throwOnDataError ?? false;
  // Prefer a single per-fixture request when the provider supports it
  // (Flashscore: both teams' form + H2H from one h2h call). Otherwise fetch each
  // team's recent matches separately (15 to give the windows + H2H enough data);
  // H2H is then derived locally instead of a 3rd request.
  const bundle = (await data.getFixtureMatches?.(fixture, t)) ?? null;
  const [homeMatches, awayMatches] = bundle
    ? [bundle.home, bundle.away]
    : await Promise.all([
        data.getTeamRecentMatches(fixture.home.id, MAX_RECENT_MATCHES, t),
        data.getTeamRecentMatches(fixture.away.id, MAX_RECENT_MATCHES, t),
      ]);

  // Adjust the windows relative to the fixture's own kickoff (so an analysis is
  // reproducible regardless of when it's run) with recency-decay + league-prior
  // shrinkage for small samples.
  const now = Date.parse(fixture.date) || Date.now();
  let homeStats = computeTeamStats(fixture.home, homeMatches, { now });
  let awayStats = computeTeamStats(fixture.away, awayMatches, { now });

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
  const h2h = computeHeadToHead(fixture.home.id, fixture.away.id, h2hPool, 10, { now });
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
  const markets = applyMarketRecalibration(
    predictMarkets(homeStats, awayStats),
    options.ou25Recalibration,
  );

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
    return { fixture, prediction: bundle.prediction, markets: bundle.markets };
  } catch (err) {
    log.warn('failed to build row', { fixture: fixture.id, err });
    return { fixture, predictionError: true };
  }
}

/** Sort rows by BTTS=YES probability (rows without a prediction go last). */
export function sortDashboardRows(rows: DashboardRow[]): DashboardRow[] {
  return [...rows].sort((a, b) => (b.prediction?.probYes ?? -1) - (a.prediction?.probYes ?? -1));
}

/** Sort rows by the dominant probability of the selected market (best first). */
export function sortDashboardRowsByMarket(rows: DashboardRow[], market: MarketKey): DashboardRow[] {
  const score = (r: DashboardRow): number => {
    const pick = marketPick(market, r.prediction, r.markets);
    return pick ? pick.probability : -1;
  };
  return [...rows].sort((a, b) => score(b) - score(a));
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
