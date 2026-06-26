import type { Competition, Fixture, MatchResult, Team } from '@/domain/types';
import {
  ProviderError,
  type DataProvider,
  type ProviderCapabilities,
  type ProviderContext,
} from '../types';
import { routeThroughProxy } from '../util';
import { bucketFor, fetchWithBackoff } from '@/data/rateLimit/rateLimiter';
import { sanitizeText } from '@/services/sanitize';
import { createLogger } from '@/services/logger';

const log = createLogger('provider:thesportsdb');
const HOST = 'https://www.thesportsdb.com/api/v1/json';

interface TsdbEvent {
  idEvent: string;
  strEvent?: string;
  dateEvent?: string; // YYYY-MM-DD
  strTime?: string; // HH:MM:SS (UTC)
  strTimestamp?: string; // ISO
  strLeague?: string;
  idLeague?: string;
  idHomeTeam?: string;
  strHomeTeam?: string;
  idAwayTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
}

function isoDate(e: TsdbEvent): string {
  if (e.strTimestamp) return e.strTimestamp;
  if (e.dateEvent) return `${e.dateEvent}T${e.strTime || '00:00:00'}Z`;
  return '';
}

function toTeam(id?: string, name?: string): Team {
  return { id: id ?? 'unknown', name: name ? sanitizeText(name) : 'Desconhecida' };
}

function toCompetition(e: TsdbEvent): Competition {
  return {
    id: e.idLeague ?? 'unknown',
    name: e.strLeague ? sanitizeText(e.strLeague) : 'Desconhecida',
  };
}

function toFixture(e: TsdbEvent): Fixture {
  return {
    id: e.idEvent,
    date: isoDate(e),
    competition: toCompetition(e),
    home: toTeam(e.idHomeTeam, e.strHomeTeam),
    away: toTeam(e.idAwayTeam, e.strAwayTeam),
  };
}

function toResult(e: TsdbEvent): MatchResult | null {
  if (e.intHomeScore == null || e.intAwayScore == null) return null;
  const homeGoals = Number(e.intHomeScore);
  const awayGoals = Number(e.intAwayScore);
  if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) return null;
  return {
    id: e.idEvent,
    date: isoDate(e),
    competitionId: e.idLeague,
    competitionName: e.strLeague ? sanitizeText(e.strLeague) : undefined,
    home: toTeam(e.idHomeTeam, e.strHomeTeam),
    away: toTeam(e.idAwayTeam, e.strAwayTeam),
    homeGoals,
    awayGoals,
  };
}

/**
 * TheSportsDB. Free and key-light — the public test key "3" works for basic
 * endpoints (enter "3" as the key). No live scores or odds on the free tier;
 * fixture coverage is limited, so it is best used as a last-resort fallback.
 */
export class TheSportsDbProvider implements DataProvider {
  readonly id = 'thesportsdb';
  readonly label = 'TheSportsDB';
  readonly docsUrl = 'https://www.thesportsdb.com/free_sports_api';
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
    await bucketFor(this.id, 30, 30 / 60).acquire();
    const target = `${HOST}/${encodeURIComponent(ctx.apiKey)}${path}`;
    const res = await fetchWithBackoff(routeThroughProxy(target, ctx.corsProxy), {});
    if (!res.ok) {
      log.warn('request failed', { path, status: res.status });
      throw new ProviderError(`Pedido falhou (${res.status})`, this.id, res.status);
    }
    return (await res.json()) as T;
  }

  async getFixturesByDate(date: string, ctx: ProviderContext): Promise<Fixture[]> {
    const data = await this.request<{ events: TsdbEvent[] | null }>(
      `/eventsday.php?d=${date}&s=Soccer`,
      ctx,
    );
    return (data.events ?? []).map(toFixture);
  }

  async getMatchResultById(matchId: string, ctx: ProviderContext): Promise<MatchResult | null> {
    const data = await this.request<{ events: TsdbEvent[] | null }>(
      `/lookupevent.php?id=${matchId}`,
      ctx,
    );
    const first = data.events?.[0];
    return first ? toResult(first) : null;
  }

  async getTeamRecentMatches(
    teamId: string,
    limit: number,
    ctx: ProviderContext,
  ): Promise<MatchResult[]> {
    const data = await this.request<{ results: TsdbEvent[] | null }>(
      `/eventslast.php?id=${teamId}`,
      ctx,
    );
    return (data.results ?? [])
      .map(toResult)
      .filter((m): m is MatchResult => m !== null)
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
