import type { Fixture, LiveMatch, MatchResult } from '@/domain/types';
import { cached, TTL } from './cache/cache';
import { getProvider, realProviders, DEFAULT_PROVIDER_ID } from './providers/registry';
import { MockProvider } from './providers/mock/MockProvider';
import type { BttsOdds, DataProvider, ProviderContext } from './providers/types';
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
  /** Per-provider API keys (device-local). */
  apiKeys: Record<string, string>;
  corsProxy?: string;
  /** Fall back to mock data when no real provider is configured. */
  fallbackToMock: boolean;
  /** Try other configured providers when the primary one fails (e.g. 429). */
  autoFallback: boolean;
}

interface ChainEntry {
  provider: DataProvider;
  ctx: ProviderContext;
}

/**
 * Orchestration layer between the UI and providers: caching, a multi-provider
 * fallback chain and a single stable surface for the app.
 *
 * Fixture/live lookups are independent, so they cascade across every configured
 * provider (primary first) when `autoFallback` is on. Team-scoped lookups
 * (history, H2H, results, odds) stay on the PRIMARY provider only — their ids
 * are provider-specific, so falling back to a different source would mismatch.
 */
export class DataService {
  constructor(private readonly config: DataServiceConfig) {}

  private get providerId(): string {
    return this.config.providerId || DEFAULT_PROVIDER_ID;
  }

  private ctxFor(providerId: string): ProviderContext {
    return { apiKey: this.config.apiKeys[providerId], corsProxy: this.config.corsProxy };
  }

  /** Ordered, configured providers for independent (fixture/live) lookups. */
  private fixturesChain(): ChainEntry[] {
    const primary = getProvider(this.providerId);
    const ordered: DataProvider[] = [primary];
    if (this.config.autoFallback) {
      for (const p of realProviders()) if (p.id !== primary.id) ordered.push(p);
    }
    return ordered
      .map((provider) => ({ provider, ctx: this.ctxFor(provider.id) }))
      .filter((e) => e.provider.isConfigured(e.ctx));
  }

  /** Cascade an independent lookup across the configured provider chain. */
  private async withChain<T>(
    cacheKey: string,
    ttl: number,
    call: (provider: DataProvider, ctx: ProviderContext) => Promise<T>,
    emptyValue: T,
    mockRun: () => Promise<T>,
    allowMock: boolean,
    throwOnError = false,
  ): Promise<T> {
    const chain = this.fixturesChain();
    if (chain.length === 0) {
      // Nothing configured → demo data only when explicitly allowed.
      if (allowMock) return cached(`mock:${cacheKey}`, ttl, mockRun);
      return emptyValue;
    }
    let lastErr: unknown;
    for (const { provider, ctx } of chain) {
      try {
        return await cached(`${provider.id}:${cacheKey}`, ttl, () => call(provider, ctx));
      } catch (err) {
        lastErr = err;
        log.warn(`provider ${provider.id} failed, trying next`, err);
      }
    }
    // Every configured provider failed. NEVER fabricate demo data here — that
    // would inject fake games. Demo data is only for the unconfigured case.
    log.error('all providers failed', lastErr);
    if (throwOnError && lastErr) throw lastErr;
    return emptyValue;
  }

  /** Run a team-scoped lookup on the PRIMARY provider only. */
  private async withPrimary<T>(
    cacheKey: string,
    ttl: number,
    run: (provider: DataProvider, ctx: ProviderContext) => Promise<T>,
    emptyValue: T,
    mockRun: () => Promise<T>,
    allowMock = this.config.fallbackToMock,
  ): Promise<T> {
    const provider = getProvider(this.providerId);
    const ctx = this.ctxFor(provider.id);
    if (!provider.isConfigured(ctx)) {
      if (allowMock) return cached(`mock:${cacheKey}`, ttl, mockRun);
      return emptyValue;
    }
    try {
      return await cached(`${provider.id}:${cacheKey}`, ttl, () => run(provider, ctx));
    } catch (err) {
      log.error('primary provider failed — returning empty (no mock substitution)', err);
      return emptyValue;
    }
  }

  getFixturesByDate(date: string): Promise<Fixture[]> {
    return this.withChain(
      `fixtures:${date}`,
      TTL.fixtures,
      (provider, ctx) => provider.getFixturesByDate(date, ctx),
      [],
      () => mock.getFixturesByDate(date),
      this.config.fallbackToMock,
      true, // surface provider errors so the dashboard can show a notice
    );
  }

  /**
   * Fixtures across a date range, chunked into ≤10-day windows (free-tier safe).
   * `allowMock` defaults to false: the calendar must reflect real sources only.
   */
  async getFixturesByRange(from: string, to: string, allowMock = false): Promise<Fixture[]> {
    const windows = chunkDateRange(from, to, 10);
    const chunks = await Promise.all(
      windows.map((w) =>
        this.withChain(
          `range:${w.from}:${w.to}`,
          TTL.fixtures,
          (provider, ctx) =>
            provider.getFixturesByRange
              ? provider.getFixturesByRange(w.from, w.to, ctx)
              : Promise.reject(new Error('range unsupported')),
          [] as Fixture[],
          () => mock.getFixturesByRange(w.from, w.to),
          allowMock,
        ),
      ),
    );
    return chunks.flat();
  }

  /** Distinct ISO dates (yyyy-MM-dd) that have at least one fixture in the range.
   * Does NOT fall back to mock — marks reflect the real source only. */
  async getFixtureDatesInRange(from: string, to: string): Promise<string[]> {
    const fixtures = await this.getFixturesByRange(from, to, false);
    return Array.from(new Set(fixtures.map((f) => f.date.slice(0, 10))));
  }

  /** Matches currently in play (live scores), cascading across providers. */
  getLiveMatches(): Promise<LiveMatch[]> {
    return this.withChain(
      'live',
      TTL.live,
      (provider, ctx) =>
        provider.getLiveMatches
          ? provider.getLiveMatches(ctx)
          : Promise.reject(new Error('live unsupported')),
      [] as LiveMatch[],
      () => mock.getLiveMatches(),
      this.config.fallbackToMock,
    );
  }

  /** Bookmaker BTTS odds for a fixture (primary provider only). Null if unavailable. */
  async getOdds(fixtureId: string): Promise<BttsOdds | null> {
    const provider = getProvider(this.providerId);
    const ctx = this.ctxFor(provider.id);
    if (!provider.getOdds || !provider.isConfigured(ctx)) return null;
    try {
      return await cached(`${provider.id}:odds:${fixtureId}`, TTL.fixtures, () =>
        provider.getOdds!(fixtureId, ctx),
      );
    } catch (err) {
      log.warn('getOdds failed', err);
      return null;
    }
  }

  /** Fetch a single finished match result by id (for backtesting). Null if unavailable. */
  async getMatchResultById(matchId: string): Promise<MatchResult | null> {
    const provider = getProvider(this.providerId);
    const ctx = this.ctxFor(provider.id);
    if (!provider.getMatchResultById || !provider.isConfigured(ctx)) return null;
    try {
      return await cached(`${provider.id}:result:${matchId}`, TTL.teamHistory, () =>
        provider.getMatchResultById!(matchId, ctx),
      );
    } catch (err) {
      log.warn('getMatchResultById failed', err);
      return null;
    }
  }

  getTeamRecentMatches(teamId: string, limit = 10): Promise<MatchResult[]> {
    return this.withPrimary(
      `team:${teamId}:${limit}`,
      TTL.teamHistory,
      (provider, ctx) => provider.getTeamRecentMatches(teamId, limit, ctx),
      [],
      () => mock.getTeamRecentMatches(teamId, limit),
    );
  }

  getHeadToHead(homeId: string, awayId: string, limit = 10): Promise<MatchResult[]> {
    return this.withPrimary(
      `h2h:${homeId}:${awayId}:${limit}`,
      TTL.h2h,
      (provider, ctx) => provider.getHeadToHead(homeId, awayId, limit, ctx),
      [],
      () => mock.getHeadToHead(homeId, awayId, limit),
    );
  }
}
