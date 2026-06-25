import type { Fixture, MatchResult } from '@/domain/types';
import {
  ProviderError,
  type DataProvider,
  type ProviderCapabilities,
  type ProviderContext,
} from '../types';
import { bucketFor, fetchWithBackoff } from '@/data/rateLimit/rateLimiter';
import { createLogger } from '@/services/logger';
import { normalizeFixture, normalizeResult, type FdMatch } from './normalize';

const log = createLogger('provider:football-data');
const ORIGIN = 'https://api.football-data.org';
const BASE = `${ORIGIN}/v4`;

/**
 * Route a target URL through an optional CORS proxy.
 *  - "...{url}"        → the encoded target replaces the placeholder
 *  - origin prefix     → the path+query is appended to the proxy origin
 */
export function applyCorsProxy(target: string, proxy?: string): string {
  if (!proxy) return target;
  if (proxy.includes('{url}')) return proxy.replace('{url}', encodeURIComponent(target));
  return proxy.replace(/\/$/, '') + target.slice(ORIGIN.length);
}

/**
 * Football-Data.org (v4) provider. Requires a free API key (set in Settings).
 *
 * NOTE: football-data.org does not send CORS headers, so direct browser calls
 * may be blocked. It works inside the Capacitor native shell or behind a CORS
 * proxy (see ARCHITECTURE.md §9.2). The implementation is correct regardless.
 */
export class FootballDataProvider implements DataProvider {
  readonly id = 'football-data';
  readonly label = 'Football-Data.org';
  readonly docsUrl = 'https://www.football-data.org/client/register';
  readonly capabilities: ProviderCapabilities = {
    fixtures: true,
    teamHistory: true,
    headToHead: true,
    worksOffline: false,
  };

  isConfigured(ctx: ProviderContext): boolean {
    return Boolean(ctx.apiKey);
  }

  private async request<T>(path: string, ctx: ProviderContext): Promise<T> {
    if (!ctx.apiKey) throw new ProviderError('Chave de API em falta', this.id);
    await bucketFor(this.id).acquire();
    const url = applyCorsProxy(`${BASE}${path}`, ctx.corsProxy);
    const res = await fetchWithBackoff(url, {
      headers: { 'X-Auth-Token': ctx.apiKey },
    });
    if (!res.ok) {
      log.warn('request failed', { path, status: res.status });
      throw new ProviderError(`Pedido falhou (${res.status})`, this.id, res.status);
    }
    return (await res.json()) as T;
  }

  async getFixturesByDate(date: string, ctx: ProviderContext): Promise<Fixture[]> {
    const data = await this.request<{ matches: FdMatch[] }>(
      `/matches?dateFrom=${date}&dateTo=${date}`,
      ctx,
    );
    return (data.matches ?? []).map(normalizeFixture);
  }

  async getTeamRecentMatches(
    teamId: string,
    limit: number,
    ctx: ProviderContext,
  ): Promise<MatchResult[]> {
    const data = await this.request<{ matches: FdMatch[] }>(
      `/teams/${teamId}/matches?status=FINISHED&limit=${limit}`,
      ctx,
    );
    return (data.matches ?? []).map(normalizeResult).filter((m): m is MatchResult => m !== null);
  }

  async getHeadToHead(
    homeId: string,
    awayId: string,
    limit: number,
    ctx: ProviderContext,
  ): Promise<MatchResult[]> {
    // Derive H2H from the home team's finished matches filtered by opponent.
    const recent = await this.getTeamRecentMatches(homeId, 50, ctx);
    return recent.filter((m) => m.home.id === awayId || m.away.id === awayId).slice(0, limit);
  }
}
