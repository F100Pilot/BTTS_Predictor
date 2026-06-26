import type { Competition, Fixture, LiveMatch, MatchResult, Team } from '@/domain/types';
import {
  ProviderError,
  type BttsOdds,
  type DataProvider,
  type ProviderCapabilities,
  type ProviderContext,
} from '../types';
import { routeThroughProxy } from '../util';
import { bucketFor, fetchWithBackoff } from '@/data/rateLimit/rateLimiter';
import { recordQuota } from '@/store/apiQuotaStore';
import { sanitizeText } from '@/services/sanitize';
import { createLogger } from '@/services/logger';

const log = createLogger('provider:api-football');
const BASE = 'https://v3.football.api-sports.io';

/** Subset of the API-Football v3 fixture shape we rely on. */
interface AfFixture {
  fixture: { id: number; date: string; status?: { short?: string; elapsed?: number | null } };
  league?: { id: number; name: string; country?: string; logo?: string };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  goals: { home: number | null; away: number | null };
}

const FINISHED = new Set(['FT', 'AET', 'PEN']);
const LIVE = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);

function toTeam(t: { id: number; name: string; logo?: string }, country?: string): Team {
  return { id: String(t.id), name: sanitizeText(t.name), crest: t.logo, country };
}

function toCompetition(l?: AfFixture['league']): Competition {
  return {
    id: l ? String(l.id) : 'unknown',
    name: l ? sanitizeText(l.name) : 'Desconhecida',
    country: l?.country ? sanitizeText(l.country) : undefined,
    emblem: l?.logo,
  };
}

function toFixture(m: AfFixture): Fixture {
  const country = m.league?.country;
  return {
    id: String(m.fixture.id),
    date: m.fixture.date,
    competition: toCompetition(m.league),
    home: toTeam(m.teams.home, country),
    away: toTeam(m.teams.away, country),
  };
}

function toResult(m: AfFixture): MatchResult | null {
  if (m.goals.home == null || m.goals.away == null) return null;
  if (m.fixture.status?.short && !FINISHED.has(m.fixture.status.short)) return null;
  const country = m.league?.country;
  return {
    id: String(m.fixture.id),
    date: m.fixture.date,
    competitionId: m.league ? String(m.league.id) : undefined,
    competitionName: m.league ? sanitizeText(m.league.name) : undefined,
    home: toTeam(m.teams.home, country),
    away: toTeam(m.teams.away, country),
    homeGoals: m.goals.home,
    awayGoals: m.goals.away,
  };
}

function toLive(m: AfFixture): LiveMatch {
  const country = m.league?.country;
  return {
    id: String(m.fixture.id),
    competition: toCompetition(m.league),
    home: toTeam(m.teams.home, country),
    away: toTeam(m.teams.away, country),
    homeGoals: m.goals.home ?? 0,
    awayGoals: m.goals.away ?? 0,
    status: m.fixture.status?.short ?? 'LIVE',
    minute: m.fixture.status?.elapsed ?? undefined,
    date: m.fixture.date,
  };
}

/**
 * API-Football (v3, api-sports.io). Free tier: 100 requests/day, broad league
 * coverage, live scores and bookmaker odds. Requires a free API key.
 *
 * The direct host generally allows browser calls; if blocked by CORS, use the
 * native APK or a generic `?url={url}` proxy.
 */
export class ApiFootballProvider implements DataProvider {
  readonly id = 'api-football';
  readonly label = 'API-Football';
  readonly docsUrl = 'https://www.api-football.com/';
  readonly capabilities: ProviderCapabilities = {
    fixtures: true,
    teamHistory: true,
    headToHead: true,
    odds: true,
    worksOffline: false,
  };

  isConfigured(ctx: ProviderContext): boolean {
    return Boolean(ctx.apiKey);
  }

  private async request<T>(path: string, ctx: ProviderContext): Promise<T> {
    if (!ctx.apiKey) throw new ProviderError('Chave de API em falta', this.id);
    await bucketFor(this.id, 10, 10 / 60).acquire();
    const url = routeThroughProxy(`${BASE}${path}`, ctx.corsProxy);
    const res = await fetchWithBackoff(url, { headers: { 'x-apisports-key': ctx.apiKey } });
    const remaining = Number(res.headers.get('x-ratelimit-requests-remaining'));
    const limit = Number(res.headers.get('x-ratelimit-requests-limit'));
    if (Number.isFinite(remaining)) {
      recordQuota(this.id, {
        remaining,
        limit: Number.isFinite(limit) ? limit : undefined,
        label: 'hoje',
        updatedAt: Date.now(),
      });
    }
    if (!res.ok) {
      log.warn('request failed', { path, status: res.status });
      throw new ProviderError(`Pedido falhou (${res.status})`, this.id, res.status);
    }
    return (await res.json()) as T;
  }

  async getFixturesByDate(date: string, ctx: ProviderContext): Promise<Fixture[]> {
    const data = await this.request<{ response: AfFixture[] }>(`/fixtures?date=${date}`, ctx);
    return (data.response ?? []).map(toFixture);
  }

  async getMatchResultById(matchId: string, ctx: ProviderContext): Promise<MatchResult | null> {
    const data = await this.request<{ response: AfFixture[] }>(`/fixtures?id=${matchId}`, ctx);
    const first = data.response?.[0];
    return first ? toResult(first) : null;
  }

  async getLiveMatches(ctx: ProviderContext): Promise<LiveMatch[]> {
    const data = await this.request<{ response: AfFixture[] }>(`/fixtures?live=all`, ctx);
    return (data.response ?? []).filter((m) => LIVE.has(m.fixture.status?.short ?? '')).map(toLive);
  }

  async getOdds(fixtureId: string, ctx: ProviderContext): Promise<BttsOdds | null> {
    // bet=8 → "Both Teams Score". Take the first bookmaker that lists it.
    const data = await this.request<{
      response: Array<{
        bookmakers?: Array<{
          bets?: Array<{ id: number; values?: Array<{ value: string; odd: string }> }>;
        }>;
      }>;
    }>(`/odds?fixture=${fixtureId}&bet=8`, ctx);
    for (const entry of data.response ?? []) {
      for (const bk of entry.bookmakers ?? []) {
        const bet = bk.bets?.find((b) => b.id === 8);
        if (!bet?.values) continue;
        const yes = bet.values.find((v) => /yes/i.test(v.value));
        const no = bet.values.find((v) => /no/i.test(v.value));
        const bttsYes = yes ? Number(yes.odd) : undefined;
        const bttsNo = no ? Number(no.odd) : undefined;
        if (bttsYes || bttsNo) return { bttsYes, bttsNo };
      }
    }
    return null;
  }

  async getTeamRecentMatches(
    teamId: string,
    limit: number,
    ctx: ProviderContext,
  ): Promise<MatchResult[]> {
    const data = await this.request<{ response: AfFixture[] }>(
      `/fixtures?team=${teamId}&last=${limit}`,
      ctx,
    );
    return (data.response ?? []).map(toResult).filter((m): m is MatchResult => m !== null);
  }

  async getHeadToHead(
    homeId: string,
    awayId: string,
    limit: number,
    ctx: ProviderContext,
  ): Promise<MatchResult[]> {
    const data = await this.request<{ response: AfFixture[] }>(
      `/fixtures/headtohead?h2h=${homeId}-${awayId}&last=${limit}`,
      ctx,
    );
    return (data.response ?? []).map(toResult).filter((m): m is MatchResult => m !== null);
  }
}
