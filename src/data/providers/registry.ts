import type { DataProvider } from './types';
import { MockProvider } from './mock/MockProvider';
import { FootballDataProvider } from './footballData/FootballDataProvider';

/** Central registry of available data providers (Open/Closed: add here only). */
export const PROVIDERS: DataProvider[] = [new MockProvider(), new FootballDataProvider()];

export const DEFAULT_PROVIDER_ID = 'mock';

export function getProvider(id: string): DataProvider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]!;
}

export function listProviders(): Array<{ id: string; label: string; worksOffline: boolean }> {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    worksOffline: p.capabilities.worksOffline,
  }));
}
