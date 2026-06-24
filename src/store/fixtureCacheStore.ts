import { create } from 'zustand';
import type { Fixture } from '@/domain/types';

interface FixtureCacheState {
  byId: Record<string, Fixture>;
  put: (fixtures: Fixture[]) => void;
  get: (id: string) => Fixture | undefined;
}

/** In-memory registry so the analysis page can resolve a fixture by id. */
export const useFixtureCache = create<FixtureCacheState>((set, get) => ({
  byId: {},
  put: (fixtures) =>
    set((s) => {
      const byId = { ...s.byId };
      for (const f of fixtures) byId[f.id] = f;
      return { byId };
    }),
  get: (id) => get().byId[id],
}));

/** Best-effort date extraction from a mock fixture id (mock-YYYY-MM-DD-...). */
export function dateFromMockId(id: string): string | undefined {
  const match = id.match(/^mock-(\d{4}-\d{2}-\d{2})-/);
  return match?.[1];
}
