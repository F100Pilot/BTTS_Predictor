import { create } from 'zustand';
import { todayIso } from '@/lib/format';
import { defaultFilters, type DashboardFilterState } from '@/components/dashboard/filters';

interface DashboardFiltersStore {
  filters: DashboardFilterState;
  setFilters: (
    filtersOrUpdater: DashboardFilterState | ((prev: DashboardFilterState) => DashboardFilterState),
  ) => void;
}

/**
 * In-memory store for dashboard filter state. Not persisted — resets on
 * page reload (so the date is always today on a fresh session). Kept across
 * in-app navigation so filters survive going into an analysis and coming back.
 */
export const useDashboardFilters = create<DashboardFiltersStore>()((set) => ({
  filters: defaultFilters(todayIso()),
  setFilters: (filtersOrUpdater) =>
    set((s) => ({
      filters:
        typeof filtersOrUpdater === 'function' ? filtersOrUpdater(s.filters) : filtersOrUpdater,
    })),
}));
