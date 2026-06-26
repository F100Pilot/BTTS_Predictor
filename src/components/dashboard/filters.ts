import type { DashboardRow } from '@/domain/types';

import { computeValue } from '@/core/value/value';

export interface DashboardFilterState {
  date: string; // yyyy-MM-dd
  competition: string; // 'all' or competition name
  country: string; // 'all' or country name
  minBtts: number; // 0..100 (percentage)
  minOdds: number; // 0 = no limit
  maxOdds: number; // 0 = no limit
  search: string; // team/competition text filter
  onlyValue: boolean; // keep only rows with positive edge vs odds
  hideNoData: boolean; // drop games not yet analysed or without enough history
}

export function defaultFilters(date: string): DashboardFilterState {
  return {
    date,
    competition: 'all',
    country: 'all',
    minBtts: 0,
    minOdds: 0,
    maxOdds: 0,
    search: '',
    onlyValue: false,
    hideNoData: true,
  };
}

/** Positive edge (best side) for a row, or null when no odds/prediction. */
export function rowEdge(row: DashboardRow): number | null {
  if (!row.prediction) return null;
  const v = computeValue(row.prediction.probYes, row.fixture.odds);
  if (!v.best) return null;
  return v[v.best]?.edge ?? null;
}

export function applyFilters(rows: DashboardRow[], f: DashboardFilterState): DashboardRow[] {
  const search = f.search.trim().toLowerCase();
  return rows.filter((row) => {
    const { fixture, prediction } = row;
    // Show only games that have actually been analysed: hide rows still loading
    // (no prediction yet) and rows the model can't compute (no team history).
    if (f.hideNoData && (!prediction || prediction.insufficientData)) return false;
    if (f.competition !== 'all' && fixture.competition.name !== f.competition) return false;
    if (f.country !== 'all' && fixture.competition.country !== f.country) return false;
    if (f.minBtts > 0 && (!prediction || prediction.probYes * 100 < f.minBtts)) return false;
    const odds = fixture.odds?.bttsYes;
    if (f.minOdds > 0 && (odds == null || odds < f.minOdds)) return false;
    if (f.maxOdds > 0 && (odds == null || odds > f.maxOdds)) return false;
    if (search) {
      const hay =
        `${fixture.home.name} ${fixture.away.name} ${fixture.competition.name}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (f.onlyValue) {
      const edge = rowEdge(row);
      if (edge == null || edge <= 0) return false;
    }
    return true;
  });
}

/** Sort rows bringing a favourite competition to the top (keeps prob order within). */
export function sortByFavourite(rows: DashboardRow[], favourite: string): DashboardRow[] {
  if (!favourite) return rows;
  return [...rows].sort((a, b) => {
    const af = a.fixture.competition.name === favourite ? 0 : 1;
    const bf = b.fixture.competition.name === favourite ? 0 : 1;
    return af - bf;
  });
}

export function uniqueCompetitions(rows: DashboardRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.fixture.competition.name))).sort();
}

export function uniqueCountries(rows: DashboardRow[]): string[] {
  return Array.from(
    new Set(rows.map((r) => r.fixture.competition.country).filter((c): c is string => Boolean(c))),
  ).sort();
}
