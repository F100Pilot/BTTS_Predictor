import type { Fixture, MatchResult } from '@/domain/types';
import { cached, TTL } from './cache/cache';
import { getProvider, DEFAULT_PROVIDER_ID } from './providers/registry';
import { MockProvider } from './providers/mock/MockProvider';
import type { ProviderContext } from './providers/types';
import { createLogger } from '@/services/logger';

const log = createLogger('DataService');
const mock = new MockProvider();

export interface DataServiceConfig {
  providerId: string;
  apiKey?: string;
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
    return { apiKey: this.config.apiKey };
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
