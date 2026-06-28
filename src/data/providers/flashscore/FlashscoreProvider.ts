import type { Fixture, LiveMatch, MatchResult } from '@/domain/types';
import type { DataProvider, ProviderCapabilities, ProviderContext } from '../types';
import {
  fetchFlashscoreByDate,
  fetchFlashscoreLive,
  fetchFlashscoreFixtureMatches,
  flashFixtureToFixture,
  fixtureToLiveMatch,
} from '@/services/flashscoreClient';

/**
 * Flashscore via RapidAPI. The whole pipeline runs from Flashscore:
 *  - fixtures by date (1 request/day)
 *  - per-fixture analysis: both teams' recent form + H2H in 1 request (h2h endpoint)
 *  - live scores and results
 *
 * The RapidAPI key is passed as ctx.apiKey (injected from settings.rapidApiKey)
 * and all calls go through the user's CORS proxy (the Worker).
 */
export class FlashscoreProvider implements DataProvider {
  readonly id = 'flashscore';
  readonly label = 'Flashscore (RapidAPI)';
  readonly docsUrl = 'https://rapidapi.com/';
  readonly capabilities: ProviderCapabilities = {
    fixtures: true,
    teamHistory: true,
    headToHead: true,
    worksOffline: false,
  };

  isConfigured(ctx: ProviderContext): boolean {
    // Needs both the RapidAPI key and a CORS proxy (browser can't call RapidAPI
    // directly: CORS + the key header).
    return Boolean(ctx.apiKey && ctx.corsProxy);
  }

  async getFixturesByDate(date: string, ctx: ProviderContext): Promise<Fixture[]> {
    const fixtures = await fetchFlashscoreByDate(ctx.apiKey!, ctx.corsProxy ?? '', date);
    return fixtures.map(flashFixtureToFixture);
  }

  async getLiveMatches(ctx: ProviderContext): Promise<LiveMatch[]> {
    const fixtures = await fetchFlashscoreLive(ctx.apiKey!, ctx.corsProxy ?? '');
    return fixtures.filter((f) => f.status === 'live').map(fixtureToLiveMatch);
  }

  async getFixtureMatches(
    fixture: Fixture,
    ctx: ProviderContext,
  ): Promise<{ home: MatchResult[]; away: MatchResult[] }> {
    return fetchFlashscoreFixtureMatches(
      ctx.apiKey!,
      ctx.corsProxy ?? '',
      fixture.id,
      fixture.home,
      fixture.away,
    );
  }

  // Flashscore is keyed by match, not by team id — the per-team lookups aren't
  // used (getFixtureMatches covers analysis). Return empty so the interface is
  // satisfied and any accidental call degrades gracefully.
  getTeamRecentMatches(): Promise<MatchResult[]> {
    return Promise.resolve([]);
  }

  getHeadToHead(): Promise<MatchResult[]> {
    return Promise.resolve([]);
  }
}
