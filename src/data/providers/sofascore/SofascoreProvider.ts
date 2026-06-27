import type { Competition, Fixture, LiveMatch, MatchResult, Team } from '@/domain/types';
import {
  ProviderError,
  type DataProvider,
  type ProviderCapabilities,
  type ProviderContext,
} from '../types';
import { bucketFor, fetchWithBackoff } from '@/data/rateLimit/rateLimiter';
import { sanitizeText } from '@/services/sanitize';
import { createLogger } from '@/services/logger';

const log = createLogger('provider:sofascore');
const HOST = 'https://api.sofascore.com';

/**
 * SofaScore (unofficial public JSON API). EXPERIMENTAL — SofaScore is behind
 * Cloudflare bot protection and may return 403 to datacenter IPs (including
 * Cloudflare Workers used as the CORS proxy). It also has no documented/stable
 * contract and is subject to their Terms of Service. Use as a best-effort,
 * keyless source; expect it to break without notice.
 *
 * Network: api.sofascore.com sends no CORS headers, so browser calls must go
 * through a proxy. The bundled Cloudflare Worker forwards a `/sofa/...` path
 * prefix to api.sofascore.com (see worker/src/index.js).
 */

interface SofaTeam {
  id: number;
  name?: string;
  shortName?: string;
}

interface SofaScoreSide {
  current?: number;
}

interface SofaEvent {
  id: number;
  startTimestamp?: number; // unix seconds
  status?: { type?: string; description?: string }; // type: notstarted|inprogress|finished
  tournament?: {
    name?: string;
    category?: { name?: string };
    uniqueTournament?: { id?: number; name?: string };
  };
  homeTeam?: SofaTeam;
  awayTeam?: SofaTeam;
  homeScore?: SofaScoreSide;
  awayScore?: SofaScoreSide;
}

function isoDate(e: SofaEvent): string {
  return e.startTimestamp ? new Date(e.startTimestamp * 1000).toISOString() : '';
}

function toTeam(t?: SofaTeam): Team {
  return {
    id: t?.id != null ? String(t.id) : 'unknown',
    name: t?.name ? sanitizeText(t.name) : 'Desconhecida',
  };
}

function toCompetition(e: SofaEvent): Competition {
  const t = e.tournament;
  const name = t?.uniqueTournament?.name || t?.name || 'Desconhecida';
  return {
    id: t?.uniqueTournament?.id != null ? String(t.uniqueTournament.id) : (name ?? 'unknown'),
    name: sanitizeText(name),
    country: t?.category?.name ? sanitizeText(t.category.name) : undefined,
  };
}

function toFixture(e: SofaEvent): Fixture {
  return {
    id: String(e.id),
    date: isoDate(e),
    competition: toCompetition(e),
    home: toTeam(e.homeTeam),
    away: toTeam(e.awayTeam),
  };
}

function toResult(e: SofaEvent): MatchResult | null {
  if (e.status?.type !== 'finished') return null;
  const homeGoals = e.homeScore?.current;
  const awayGoals = e.awayScore?.current;
  if (homeGoals == null || awayGoals == null) return null;
  const comp = toCompetition(e);
  return {
    id: String(e.id),
    date: isoDate(e),
    competitionId: comp.id,
    competitionName: comp.name,
    home: toTeam(e.homeTeam),
    away: toTeam(e.awayTeam),
    homeGoals,
    awayGoals,
  };
}

function toLive(e: SofaEvent): LiveMatch {
  const comp = toCompetition(e);
  return {
    id: String(e.id),
    competition: comp,
    home: toTeam(e.homeTeam),
    away: toTeam(e.awayTeam),
    homeGoals: e.homeScore?.current ?? 0,
    awayGoals: e.awayScore?.current ?? 0,
    status: e.status?.description || e.status?.type || 'LIVE',
    date: isoDate(e) || undefined,
  };
}

/**
 * Build the request URL. SofaScore needs a CORS proxy:
 *  - placeholder proxy ("...{url}")     → encoded target replaces {url}
 *  - origin-prefix proxy (the Worker)   → path is appended under "/sofa"
 */
function sofaUrl(path: string, proxy?: string): string {
  const target = `${HOST}${path}`;
  if (!proxy) return target;
  if (proxy.includes('{url}')) return proxy.replace('{url}', encodeURIComponent(target));
  return proxy.replace(/\/$/, '') + '/sofa' + path;
}

export class SofascoreProvider implements DataProvider {
  readonly id = 'sofascore';
  readonly label = 'SofaScore (experimental)';
  readonly docsUrl = 'https://www.sofascore.com/';
  readonly capabilities: ProviderCapabilities = {
    fixtures: true,
    teamHistory: true,
    headToHead: true,
    keyless: true,
    worksOffline: false,
  };

  /** Keyless — but practically requires a CORS proxy (the Worker). */
  isConfigured(): boolean {
    return true;
  }

  private async request<T>(path: string, ctx: ProviderContext): Promise<T> {
    await bucketFor(this.id, 20, 20 / 60).acquire();
    const res = await fetchWithBackoff(sofaUrl(path, ctx.corsProxy), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      log.warn('request failed', { path, status: res.status });
      throw new ProviderError(
        res.status === 403
          ? 'SofaScore bloqueou o pedido (403). A proteção anti-bot impede o acesso.'
          : `Pedido falhou (${res.status})`,
        this.id,
        res.status,
      );
    }
    return (await res.json()) as T;
  }

  async getFixturesByDate(date: string, ctx: ProviderContext): Promise<Fixture[]> {
    const data = await this.request<{ events?: SofaEvent[] }>(
      `/api/v1/sport/football/scheduled-events/${date}`,
      ctx,
    );
    return (data.events ?? []).map(toFixture);
  }

  async getMatchResultById(matchId: string, ctx: ProviderContext): Promise<MatchResult | null> {
    const data = await this.request<{ event?: SofaEvent }>(`/api/v1/event/${matchId}`, ctx);
    return data.event ? toResult(data.event) : null;
  }

  async getLiveMatches(ctx: ProviderContext): Promise<LiveMatch[]> {
    const data = await this.request<{ events?: SofaEvent[] }>(
      `/api/v1/sport/football/events/live`,
      ctx,
    );
    return (data.events ?? []).map(toLive);
  }

  async getTeamRecentMatches(
    teamId: string,
    limit: number,
    ctx: ProviderContext,
  ): Promise<MatchResult[]> {
    const data = await this.request<{ events?: SofaEvent[] }>(
      `/api/v1/team/${teamId}/events/last/0`,
      ctx,
    );
    return (data.events ?? [])
      .map(toResult)
      .filter((m): m is MatchResult => m !== null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async getHeadToHead(
    homeId: string,
    awayId: string,
    limit: number,
    ctx: ProviderContext,
  ): Promise<MatchResult[]> {
    // Derive from the home team's recent matches filtered by the opponent.
    const recent = await this.getTeamRecentMatches(homeId, 50, ctx);
    return recent.filter((m) => m.home.id === awayId || m.away.id === awayId).slice(0, limit);
  }
}
