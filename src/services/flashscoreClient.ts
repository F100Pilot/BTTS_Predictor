/**
 * Thin client for the Flashscore RapidAPI, routed through the user's CORS proxy
 * (their Cloudflare Worker). The proxy forwards the x-rapidapi-* headers and the
 * key/host stay device-local (settings), never in the repo.
 */

import { parseFlashscoreMatches, type FlashFixture } from './flashscoreMatches';

const HOST = 'flashscore4.p.rapidapi.com';

/** Build a proxied URL for `target` via the configured CORS proxy ('' if none). */
export function proxyFor(corsProxy: string, target: string): string | null {
  const p = corsProxy.trim();
  if (!p) return null;
  if (p.includes('{url}')) return p.replace('{url}', encodeURIComponent(target));
  return p.replace(/\/+$/, '') + '/?url=' + encodeURIComponent(target);
}

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
