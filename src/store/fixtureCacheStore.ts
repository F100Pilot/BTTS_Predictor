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
