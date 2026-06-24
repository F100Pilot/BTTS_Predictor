import type { DashboardRow } from '@/domain/types';

export interface DashboardFilterState {
  date: string; // yyyy-MM-dd
  competition: string; // 'all' or competition name
  country: string; // 'all' or country name
  minBtts: number; // 0..100 (percentage)
  minOdds: number; // 0 = no limit
  maxOdds: number; // 0 = no limit
}

export function defaultFilters(date: string): DashboardFilterState {
  return { date, competition: 'all', country: 'all', minBtts: 0, minOdds: 0, maxOdds: 0 };
}

export function applyFilters(rows: DashboardRow[], f: DashboardFilterState): DashboardRow[] {
  return rows.filter(({ fixture, prediction }) => {
    if (f.competition !== 'all' && fixture.competition.name !== f.competition) return false;
    if (f.country !== 'all' && fixture.competition.country !== f.country) return false;
    if (prediction.probYes * 100 < f.minBtts) return false;
    const odds = fixture.odds?.bttsYes;
    if (f.minOdds > 0 && (odds == null || odds < f.minOdds)) return false;
    if (f.maxOdds > 0 && (odds == null || odds > f.maxOdds)) return false;
    return true;
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
