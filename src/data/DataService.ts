import type { Fixture, MatchResult } from '@/domain/types';
import { cached, TTL } from './cache/cache';
import { getProvider, DEFAULT_PROVIDER_ID } from './providers/registry';
import { MockProvider } from './providers/mock/MockProvider';
import type { ProviderContext } from './providers/types';
import { createLogger } from '@/services/logger';

const log = createLogger('DataService');
const mock = new MockProvider();

/** Split an inclusive ISO date range into windows of at most `maxDays` days. */
export function chunkDateRange(
  from: string,
  to: string,
  maxDays: number,
): Array<{ from: string; to: string }> {
  const windows: Array<{ from: string; to: string }> = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const cursor = new Date(start);
  while (cursor <= end) {
    const windowStart = new Date(cursor);
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + maxDays - 1);
    if (windowEnd > end) windowEnd.setTime(end.getTime());
    windows.push({
      from: windowStart.toISOString().slice(0, 10),
      to: windowEnd.toISOString().slice(0, 10),
    });
    cursor.setUTCDate(cursor.getUTCDate() + maxDays);
  }
  return windows;
}

export interface DataServiceConfig {
  providerId: string;
  apiKey?: string;
  corsProxy?: string;
  /** Fall back to mock data when the active provider fails / is unconfigured. */
  fallbackToMock: boolean;
}

/**
 * Orchestration layer between the UI and providers:
 * caching, graceful fallback and a single stable surface for the app.
 */
export class DataService {
  constructor(private readonly config: DataServiceConfig) {}

  private get ctx(): ProviderContext {
    return { apiKey: this.config.apiKey, corsProxy: this.config.corsProxy };
  }

  private get providerId(): string {
    return this.config.providerId || DEFAULT_PROVIDER_ID;
  }

  private async withFallback<T>(
    cacheKey: string,
    ttl: number,
    run: (ctx: ProviderContext) => Promise<T>,
    emptyValue: T,
    mockRun: () => Promise<T>,
  ): Promise<T> {
    const provider = getProvider(this.providerId);
    if (!provider.isConfigured(this.ctx)) {
      if (this.config.fallbackToMock) {
        log.info('provider not configured, using mock', { provider: provider.id });
        return cached(`mock:${cacheKey}`, ttl, mockRun);
      }
      return emptyValue;
    }
    try {
      return await cached(`${provider.id}:${cacheKey}`, ttl, () => run(this.ctx));
    } catch (err) {
      log.error('provider failed', err);
      if (this.config.fallbackToMock) return cached(`mock:${cacheKey}`, ttl, mockRun);
      throw err;
    }
  }

  getFixturesByDate(date: string): Promise<Fixture[]> {
    return this.withFallback(
      `fixtures:${date}`,
      TTL.fixtures,
      (ctx) => getProvider(this.providerId).getFixturesByDate(date, ctx),
      [],
      () => mock.getFixturesByDate(date),
    );
  }

  /** Fixtures across a date range, chunked into ≤10-day windows (free-tier safe). */
  async getFixturesByRange(from: string, to: string): Promise<Fixture[]> {
    const windows = chunkDateRange(from, to, 10);
    const chunks = await Promise.all(
      windows.map((w) =>
        this.withFallback(
          `range:${w.from}:${w.to}`,
          TTL.fixtures,
          (ctx) => {
            const provider = getProvider(this.providerId);
            return provider.getFixturesByRange
              ? provider.getFixturesByRange(w.from, w.to, ctx)
              : Promise.resolve<Fixture[]>([]);
          },
          [] as Fixture[],
          () => mock.getFixturesByRange(w.from, w.to),
        ),
      ),
    );
    return chunks.flat();
  }

  /** Distinct ISO dates (yyyy-MM-dd) that have at least one fixture in the range. */
  async getFixtureDatesInRange(from: string, to: string): Promise<string[]> {
    const fixtures = await this.getFixturesByRange(from, to);
    return Array.from(new Set(fixtures.map((f) => f.date.slice(0, 10))));
  }

  /** Fetch a single finished match result by id (for backtesting). Null if unavailable. */
  async getMatchResultById(matchId: string): Promise<MatchResult | null> {
    const provider = getProvider(this.providerId);
    if (!provider.getMatchResultById || !provider.isConfigured(this.ctx)) return null;
    try {
      return await cached(`${provider.id}:result:${matchId}`, TTL.teamHistory, () =>
        provider.getMatchResultById!(matchId, this.ctx),
      );
    } catch (err) {
      log.warn('getMatchResultById failed', err);
      return null;
    }
  }

  getTeamRecentMatches(teamId: string, limit = 10): Promise<MatchResult[]> {
    return this.withFallback(
      `team:${teamId}:${limit}`,
      TTL.teamHistory,
      (ctx) => getProvider(this.providerId).getTeamRecentMatches(teamId, limit, ctx),
      [],
      () => mock.getTeamRecentMatches(teamId, limit),
    );
  }

  getHeadToHead(homeId: string, awayId: string, limit = 10): Promise<MatchResult[]> {
    return this.withFallback(
      `h2h:${homeId}:${awayId}:${limit}`,
      TTL.h2h,
      (ctx) => getProvider(this.providerId).getHeadToHead(homeId, awayId, limit, ctx),
      [],
      () => mock.getHeadToHead(homeId, awayId, limit),
    );
  }
}
