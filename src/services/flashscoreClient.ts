/**
 * Thin client for the Flashscore RapidAPI, routed through the user's CORS proxy
 * (their Cloudflare Worker). The proxy forwards the x-rapidapi-* headers and the
 * key/host stay device-local (settings), never in the repo.
 */

import { parseFlashscoreMatches, type FlashFixture } from './flashscoreMatches';
import { proxyFor } from './corsProxy';
import type { LiveMatch } from '@/domain/types';

const HOST = 'flashscore4.p.rapidapi.com';

export { proxyFor };

async function getJson(target: string, rapidApiKey: string, corsProxy: string): Promise<unknown> {
  const proxied = proxyFor(corsProxy, target);
  if (!proxied) throw new Error('no-cors-proxy');
  const res = await fetch(proxied, {
    headers: { 'x-rapidapi-key': rapidApiKey.trim(), 'x-rapidapi-host': HOST },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** Currently in-play matches (live scores) as flattened fixtures. */
export async function fetchFlashscoreLive(
  rapidApiKey: string,
  corsProxy: string,
  timezone = 'Europe/Lisbon',
): Promise<FlashFixture[]> {
  const target = `https://${HOST}/api/flashscore/v2/matches/live?sport_id=1&timezone=${encodeURIComponent(timezone)}`;
  return parseFlashscoreMatches(await getJson(target, rapidApiKey, corsProxy));
}

/** All matches for a given day (YYYY-MM-DD) — scheduled, live and finished. */
export async function fetchFlashscoreByDate(
  rapidApiKey: string,
  corsProxy: string,
  date: string,
  timezone = 'Europe/Lisbon',
): Promise<FlashFixture[]> {
  const target = `https://${HOST}/api/flashscore/v2/matches/list-by-date?sport_id=1&date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(timezone)}`;
  return parseFlashscoreMatches(await getJson(target, rapidApiKey, corsProxy));
}

export interface FlashscoreQuota {
  /** Total requests allowed in the current period (plan quota), or null. */
  limit: number | null;
  /** Requests left in the current period, or null. */
  remaining: number | null;
}

/**
 * Read the RapidAPI quota from the response headers via one cheap live call.
 * The worker exposes x-ratelimit-requests-limit/remaining through CORS.
 */
export async function fetchFlashscoreQuota(
  rapidApiKey: string,
  corsProxy: string,
): Promise<FlashscoreQuota> {
  const target = `https://${HOST}/api/flashscore/v2/matches/live?sport_id=1&timezone=Europe%2FLisbon`;
  const proxied = proxyFor(corsProxy, target);
  if (!proxied) throw new Error('no-cors-proxy');
  const res = await fetch(proxied, {
    headers: { 'x-rapidapi-key': rapidApiKey.trim(), 'x-rapidapi-host': HOST },
  });
  if (!res.ok) throw new Error(String(res.status));
  const num = (h: string): number | null => {
    const v = res.headers.get(h);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    limit: num('x-ratelimit-requests-limit'),
    remaining: num('x-ratelimit-requests-remaining'),
  };
}

/** Adapt a Flashscore fixture to the app's LiveMatch shape (for the live page). */
export function fixtureToLiveMatch(f: FlashFixture): LiveMatch {
  return {
    id: f.matchId,
    competition: { id: '', name: f.tournament || f.country || 'Flashscore' },
    home: { id: f.home.id, name: f.home.name },
    away: { id: f.away.id, name: f.away.name },
    homeGoals: f.scores.home ?? 0,
    awayGoals: f.scores.away ?? 0,
    status: f.status === 'live' ? 'IN_PLAY' : f.status.toUpperCase(),
    date: undefined,
  };
}
