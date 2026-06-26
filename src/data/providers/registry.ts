import type { DataProvider } from './types';
import { MockProvider } from './mock/MockProvider';
import { FootballDataProvider } from './footballData/FootballDataProvider';
import { ApiFootballProvider } from './apiFootball/ApiFootballProvider';
import { SportmonksProvider } from './sportmonks/SportmonksProvider';
import { TheSportsDbProvider } from './theSportsDb/TheSportsDbProvider';

/** Central registry of available data providers (Open/Closed: add here only). */
export const PROVIDERS: DataProvider[] = [
  new MockProvider(),
  new FootballDataProvider(),
  new ApiFootballProvider(),
  new SportmonksProvider(),
  new TheSportsDbProvider(),
];

export const DEFAULT_PROVIDER_ID = 'mock';

export function getProvider(id: string): DataProvider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]!;
}

/** Real (non-mock) providers, in registry order — used to build fallback chains. */
export function realProviders(): DataProvider[] {
  return PROVIDERS.filter((p) => p.id !== 'mock');
}

export function listProviders(): Array<{ id: string; label: string; worksOffline: boolean }> {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    worksOffline: p.capabilities.worksOffline,
  }));
}
