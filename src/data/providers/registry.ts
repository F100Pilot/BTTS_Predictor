import type { DataProvider } from './types';
import { FootballDataProvider } from './footballData/FootballDataProvider';
import { ApiFootballProvider } from './apiFootball/ApiFootballProvider';

/**
 * Central registry of available data providers (Open/Closed: add here only).
 * Only the two real sources with usable BTTS coverage are kept — Football-Data
 * (free, per-minute limit, big leagues) and API-Football (deep team history).
 * SportMonks (paid), TheSportsDB (thin coverage), SofaScore (Cloudflare 403) and
 * the offline demo source were removed: the app shows real data only.
 */
export const PROVIDERS: DataProvider[] = [new FootballDataProvider(), new ApiFootballProvider()];

export const DEFAULT_PROVIDER_ID = 'football-data';

export function getProvider(id: string): DataProvider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]!;
}

/** All providers, in registry order — used to build fallback chains. */
export function realProviders(): DataProvider[] {
  return PROVIDERS;
}

export function listProviders(): Array<{ id: string; label: string; worksOffline: boolean }> {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    worksOffline: p.capabilities.worksOffline,
  }));
}
