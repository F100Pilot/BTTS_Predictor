import type { Competition, Fixture, LiveMatch, MatchResult, Team } from '@/domain/types';
import type { DataProvider, ProviderCapabilities } from '../types';
import { hashString, poisson, seeded } from './random';
import {
  MOCK_COMPETITIONS,
  competitionOf,
  getMockTeam,
  type MockCompetition,
  type MockTeam,
} from './dataset';

function toTeam(t: MockTeam): Team {
  return { id: t.id, name: t.name, country: t.country };
}

function toCompetition(c: MockCompetition): Competition {
  return { id: c.id, name: c.name, country: c.country };
}

/** Deterministic round-robin-ish pairing for a given date. */
function pairingsForDate(
  date: string,
): Array<{ comp: MockCompetition; home: MockTeam; away: MockTeam }> {
  const rng = seeded(hashString('fixtures:' + date));
  const result: Array<{ comp: MockCompetition; home: MockTeam; away: MockTeam }> = [];
  for (const comp of MOCK_COMPETITIONS) {
    const teams = comp.teamIds
      .map((id) => getMockTeam(id))
      .filter((t): t is MockTeam => Boolean(t))
      .sort(() => rng() - 0.5);
    for (let i = 0; i + 1 < teams.length; i += 2) {
      const home = teams[i];
      const away = teams[i + 1];
      if (home && away) result.push({ comp, home, away });
    }
  }
  return result;
}

/** Simulate one match between two teams with a per-match seed. */
function simulateMatch(
  home: MockTeam,
  away: MockTeam,
  seedKey: string,
): { hg: number; ag: number } {
  const rng = seeded(hashString(seedKey));
  const homeAdvantage = 1.15;
  const lambdaHome = ((home.attack + away.defense) / 2) * homeAdvantage;
  const lambdaAway = (away.attack + home.defense) / 2;
  return {
    hg: Math.min(7, poisson(lambdaHome, rng)),
    ag: Math.min(7, poisson(lambdaAway, rng)),
  };
}

function isoDateMinusDays(base: string, days: number): string {
  const d = new Date(base + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fully offline, deterministic provider. Default source so the app works
 * immediately on GitHub Pages without any API key.
 */
export class MockProvider implements DataProvider {
  readonly id = 'mock';
  readonly label = 'Dados de Demonstração (offline)';
  readonly capabilities: ProviderCapabilities = {
    fixtures: true,
    teamHistory: true,
    headToHead: true,
    worksOffline: true,
  };

  isConfigured(): boolean {
    return true;
  }

  async getFixturesByDate(date: string): Promise<Fixture[]> {
    const pairings = pairingsForDate(date);
    return pairings.map(({ comp, home, away }, index) => {
      const rng = seeded(hashString(`time:${date}:${home.id}:${away.id}`));
      const hour = 12 + Math.floor(rng() * 9); // 12:00–20:00
      const minute = rng() > 0.5 ? 30 : 0;
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
      const bttsYes = 1.5 + rng() * 1.2;
      return {
        id: `mock-${date}-${comp.id}-${index}`,
        date: `${date}T${time}`,
        competition: toCompetition(comp),
        home: toTeam(home),
        away: toTeam(away),
        odds: { bttsYes: Number(bttsYes.toFixed(2)), bttsNo: Number((1 + 1 / bttsYes).toFixed(2)) },
      } satisfies Fixture;
    });
  }

  async getFixturesByRange(from: string, to: string): Promise<Fixture[]> {
    const out: Fixture[] = [];
    const start = new Date(`${from}T12:00:00Z`);
    const end = new Date(`${to}T12:00:00Z`);
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      out.push(...(await this.getFixturesByDate(iso)));
    }
    return out;
  }

  async getLiveMatches(): Promise<LiveMatch[]> {
    const today = new Date().toISOString().slice(0, 10);
    const fixtures = await this.getFixturesByDate(today);
    const now = new Date();
    const bucket = Math.floor(now.getTime() / (5 * 60 * 1000)); // changes every 5 min
    return fixtures.slice(0, 3).map((f, i) => {
      const minute = 5 + ((now.getUTCMinutes() + i * 25) % 88);
      const rng = seeded(hashString(`live:${f.id}:${bucket}`));
      const hg = Math.min(5, poisson((minute / 90) * 1.6, rng));
      const ag = Math.min(5, poisson((minute / 90) * 1.4, rng));
      return {
        id: f.id,
        competition: f.competition,
        home: f.home,
        away: f.away,
        homeGoals: hg,
        awayGoals: ag,
        status: minute >= 45 && minute <= 48 ? 'PAUSED' : 'IN_PLAY',
        minute,
        date: f.date,
      } satisfies LiveMatch;
    });
  }

  async getTeamRecentMatches(teamId: string, limit: number): Promise<MatchResult[]> {
    const team = getMockTeam(teamId);
    const comp = competitionOf(teamId);
    if (!team || !comp) return [];
    const opponents = comp.teamIds.filter((id) => id !== teamId);
    const today = new Date().toISOString().slice(0, 10);
    const matches: MatchResult[] = [];

    for (let i = 0; i < limit; i++) {
      const oppId = opponents[i % opponents.length];
      const opponent = oppId ? getMockTeam(oppId) : undefined;
      if (!opponent) continue;
      const date = isoDateMinusDays(today, (i + 1) * 7);
      const atHome = i % 2 === 0;
      const home = atHome ? team : opponent;
      const away = atHome ? opponent : team;
      const { hg, ag } = simulateMatch(home, away, `hist:${teamId}:${i}`);
      matches.push({
        id: `mockh-${teamId}-${i}`,
        date,
        competitionId: comp.id,
        competitionName: comp.name,
        home: toTeam(home),
        away: toTeam(away),
        homeGoals: hg,
        awayGoals: ag,
      });
    }
    return matches;
  }

  async getHeadToHead(homeId: string, awayId: string, limit: number): Promise<MatchResult[]> {
    const home = getMockTeam(homeId);
    const away = getMockTeam(awayId);
    if (!home || !away) return [];
    const comp = competitionOf(homeId);
    const today = new Date().toISOString().slice(0, 10);
    const matches: MatchResult[] = [];
    for (let i = 0; i < limit; i++) {
      const swap = i % 2 === 1;
      const h = swap ? away : home;
      const a = swap ? home : away;
      const { hg, ag } = simulateMatch(h, a, `h2h:${homeId}:${awayId}:${i}`);
      matches.push({
        id: `mockh2h-${homeId}-${awayId}-${i}`,
        date: isoDateMinusDays(today, (i + 1) * 120),
        competitionId: comp?.id,
        competitionName: comp?.name,
        home: toTeam(h),
        away: toTeam(a),
        homeGoals: hg,
        awayGoals: ag,
      });
    }
    return matches;
  }
}
