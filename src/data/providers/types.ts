import type { Fixture, MatchResult } from '@/domain/types';

export interface ProviderCapabilities {
  fixtures: boolean;
  teamHistory: boolean;
  headToHead: boolean;
  /** True if usable without any user-supplied API key. */
  worksOffline: boolean;
}

export interface ProviderContext {
  /** API key supplied by the user (from settings), if any. */
  apiKey?: string;
  /**
   * Optional CORS proxy. Two forms are supported:
   *  - placeholder: "https://corsproxy.io/?url={url}" ({url} = encoded target)
   *  - origin prefix: "https://my-worker.workers.dev" (path is appended)
   */
  corsProxy?: string;
}

/**
 * Strategy contract every data source implements. Adding a new source means
 * adding a class — no changes to the rest of the app (Open/Closed Principle).
 */
export interface DataProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  /** Docs / signup URL for obtaining a key. */
  readonly docsUrl?: string;

  /** Whether the provider has everything it needs to make requests. */
  isConfigured(ctx: ProviderContext): boolean;

  getFixturesByDate(date: string, ctx: ProviderContext): Promise<Fixture[]>;
  /** Optional: fetch fixtures across a date range (inclusive, ISO yyyy-MM-dd). */
  getFixturesByRange?(from: string, to: string, ctx: ProviderContext): Promise<Fixture[]>;
  getTeamRecentMatches(teamId: string, limit: number, ctx: ProviderContext): Promise<MatchResult[]>;
  getHeadToHead(
    homeId: string,
    awayId: string,
    limit: number,
    ctx: ProviderContext,
  ): Promise<MatchResult[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
