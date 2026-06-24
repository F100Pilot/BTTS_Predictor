import type { AnalysisBundle, DashboardRow, Fixture } from '@/domain/types';
import { DataService } from '@/data/DataService';
import { computeHeadToHead, computeTeamStats } from '@/core/statistics/statistics';
import { predict } from '@/core/prediction/engine';
import type { FactorKey } from '@/core/prediction/weights';
import { createLogger } from '@/services/logger';

const log = createLogger('analysisService');

export interface AnalysisOptions {
  weights?: Record<FactorKey, number>;
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
  const prediction = predict({ home: homeStats, away: awayStats, h2h, weights: options.weights });

  return {
    fixture,
    homeStats,
    awayStats,
    h2h,
    prediction,
    generatedAt: new Date().toISOString(),
  };
}

/** Build dashboard rows (fixture + prediction) for a list of fixtures. */
export async function buildDashboardRows(
  data: DataService,
  fixtures: Fixture[],
  options: AnalysisOptions = {},
): Promise<DashboardRow[]> {
  const rows = await Promise.all(
    fixtures.map(async (fixture) => {
      try {
        const bundle = await buildAnalysis(data, fixture, options);
        return { fixture, prediction: bundle.prediction } satisfies DashboardRow;
      } catch (err) {
        log.warn('failed to build row', { fixture: fixture.id, err });
        return null;
      }
    }),
  );
  return rows
    .filter((r): r is DashboardRow => r !== null)
    .sort((a, b) => b.prediction.probYes - a.prediction.probYes);
}
