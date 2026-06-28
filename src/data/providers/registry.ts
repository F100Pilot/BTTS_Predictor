import type { DataProvider } from './types';
import { FlashscoreProvider } from './flashscore/FlashscoreProvider';

/**
 * Central registry of available data providers (Open/Closed: add here only).
 * Flashscore (RapidAPI) is the sole source — broad league coverage and the full
 * pipeline (fixtures, per-fixture form + H2H, live, results) at ~1 request per
 * analysed game. Football-Data and API-Football were removed (their free tiers
 * returned too little usable data for the predictions).
 */
export const PROVIDERS: DataProvider[] = [new FlashscoreProvider()];

export const DEFAULT_PROVIDER_ID = 'flashscore';

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
