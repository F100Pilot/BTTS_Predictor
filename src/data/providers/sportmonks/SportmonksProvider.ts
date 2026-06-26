import type { Competition, Fixture, LiveMatch, MatchResult, Team } from '@/domain/types';
import {
  ProviderError,
  type DataProvider,
  type ProviderCapabilities,
  type ProviderContext,
} from '../types';
import { routeThroughProxy } from '../util';
import { bucketFor, fetchWithBackoff } from '@/data/rateLimit/rateLimiter';
import { recordQuota } from '@/store/apiQuotaStore';
import { sanitizeText } from '@/services/sanitize';
import { createLogger } from '@/services/logger';

const log = createLogger('provider:sportmonks');
const BASE = 'https://api.sportmonks.com/v3/football';
const INCLUDE = 'participants;scores;league;state';

interface SmParticipant {
  id: number;
  name: string;
  image_path?: string;
  meta?: { location?: 'home' | 'away' };
}
interface SmScore {
  description?: string;
  score?: { goals?: number; participant?: 'home' | 'away' };
}
interface SmFixture {
  id: number;
  starting_at?: string; // "YYYY-MM-DD HH:MM:SS" (UTC)
  participants?: SmParticipant[];
  scores?: SmScore[];
  league?: { id: number; name: string; image_path?: string };
  state?: { developer_name?: string };
}

const FINISHED = new Set(['FT', 'AET', 'FT_PEN', 'AWARDED']);
const LIVE = new Set(['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'HT', 'INPLAY_ET', 'INPLAY_PENALTIES']);

function isoDate(s?: string): string {
  return s ? s.replace(' ', 'T') + 'Z' : '';
}

function participant(m: SmFixture, loc: 'home' | 'away'): SmParticipant | undefined {
  return m.participants?.find((p) => p.meta?.location === loc);
}

function toTeam(p?: SmParticipant): Team {
  return p
    ? { id: String(p.id), name: sanitizeText(p.name), crest: p.image_path }
    : { id: 'unknown', name: 'Desconhecida' };
}

function toCompetition(l?: SmFixture['league']): Competition {
  return {
    id: l ? String(l.id) : 'unknown',
    name: l ? sanitizeText(l.name) : 'Desconhecida',
    emblem: l?.image_path,
  };
}

function goalsFor(m: SmFixture, loc: 'home' | 'away'): number | null {
  const entry = m.scores?.find((s) => s.description === 'CURRENT' && s.score?.participant === loc);
  return entry?.score?.goals ?? null;
}

function toFixture(m: SmFixture): Fixture {
  return {
    id: String(m.id),
    date: isoDate(m.starting_at),
    competition: toCompetition(m.league),
    home: toTeam(participant(m, 'home')),
    away: toTeam(participant(m, 'away')),
  };
}

function toResult(m: SmFixture): MatchResult | null {
  if (m.state?.developer_name && !FINISHED.has(m.state.developer_name)) return null;
  const home = goalsFor(m, 'home');
  const away = goalsFor(m, 'away');
  if (home == null || away == null) return null;
  return {
    id: String(m.id),
    date: isoDate(m.starting_at),
    competitionId: m.league ? String(m.league.id) : undefined,
    competitionName: m.league ? sanitizeText(m.league.name) : undefined,
    home: toTeam(participant(m, 'home')),
    away: toTeam(participant(m, 'away')),
    homeGoals: home,
    awayGoals: away,
  };
}

function toLive(m: SmFixture): LiveMatch {
  return {
    id: String(m.id),
    competition: toCompetition(m.league),
    home: toTeam(participant(m, 'home')),
    away: toTeam(participant(m, 'away')),
    homeGoals: goalsFor(m, 'home') ?? 0,
    awayGoals: goalsFor(m, 'away') ?? 0,
    status: m.state?.developer_name ?? 'LIVE',
    date: isoDate(m.starting_at),
  };
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * SportMonks (v3). High-quality data; the free plan covers a limited set of
 * leagues (e.g. Danish Superliga, Scottish Premiership). Requires an API token.
 */
export class SportmonksProvider implements DataProvider {
  readonly id = 'sportmonks';
  readonly label = 'SportMonks';
  readonly docsUrl = 'https://www.sportmonks.com/football-api/';
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
    await bucketFor(this.id, 10, 10 / 60).acquire();
    const sep = path.includes('?') ? '&' : '?';
    const target = `${BASE}${path}${sep}api_token=${encodeURIComponent(ctx.apiKey)}`;
    const res = await fetchWithBackoff(routeThroughProxy(target, ctx.corsProxy), {});
    if (!res.ok) {
      log.warn('request failed', { path, status: res.status });
      throw new ProviderError(`Pedido falhou (${res.status})`, this.id, res.status);
    }
    const json = await res.json();
    // SportMonks reports the rate limit in the response body.
    const rl = (json as { rate_limit?: { remaining?: number; limit?: number } }).rate_limit;
    if (rl && typeof rl.remaining === 'number') {
      recordQuota(this.id, {
        remaining: rl.remaining,
        limit: typeof rl.limit === 'number' ? rl.limit : undefined,
        label: 'por hora',
        updatedAt: Date.now(),
      });
    }
    return json as T;
  }

  async getFixturesByDate(date: string, ctx: ProviderContext): Promise<Fixture[]> {
    const data = await this.request<{ data: SmFixture[] }>(
      `/fixtures/date/${date}?include=${INCLUDE}`,
      ctx,
    );
    return (data.data ?? []).map(toFixture);
  }

  async getMatchResultById(matchId: string, ctx: ProviderContext): Promise<MatchResult | null> {
    const data = await this.request<{ data: SmFixture }>(
      `/fixtures/${matchId}?include=${INCLUDE}`,
      ctx,
    );
    return data.data ? toResult(data.data) : null;
  }

  async getLiveMatches(ctx: ProviderContext): Promise<LiveMatch[]> {
    const data = await this.request<{ data: SmFixture[] }>(
      `/livescores/inplay?include=${INCLUDE}`,
      ctx,
    );
    return (data.data ?? [])
      .filter((m) => !m.state?.developer_name || LIVE.has(m.state.developer_name))
      .map(toLive);
  }

  async getTeamRecentMatches(
    teamId: string,
    limit: number,
    ctx: ProviderContext,
  ): Promise<MatchResult[]> {
    const data = await this.request<{ data: SmFixture[] }>(
      `/fixtures/between/${daysAgoIso(180)}/${daysAgoIso(0)}/${teamId}?include=${INCLUDE}`,
      ctx,
    );
    return (data.data ?? [])
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
    const data = await this.request<{ data: SmFixture[] }>(
      `/fixtures/head-to-head/${homeId}/${awayId}?include=${INCLUDE}`,
      ctx,
    );
    return (data.data ?? [])
      .map(toResult)
      .filter((m): m is MatchResult => m !== null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }
}
