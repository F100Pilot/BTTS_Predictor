/**
 * Turn a Flashscore "match h2h" response into each team's recent matches as
 * MatchResult[], so the standard prediction pipeline (computeTeamStats +
 * computeHeadToHead) can run from a SINGLE Flashscore request per fixture.
 *
 * The h2h endpoint returns a flat array mixing both teams' recent games plus
 * their head-to-head. We split it by team name and assign the fixture's real
 * team ids (so the local H2H derivation matches the home/away encounter by id).
 */
import type { MatchResult, Team } from '@/domain/types';
import { goalsOf, isFriendly, normName, toMatchArray, type FlashMatch } from './flashscoreH2H';

const RECENT = 15;

/**
 * Canonical, caller-independent id for a team in the Flashscore analysis.
 * Derived from the NAME (not the fixture's provider id) so the per-fixture
 * matches cache (keyed only by match id) stays consistent no matter who asks —
 * the dashboard (real fixture ids), a bet, or a history record (names only).
 * Consumers must key their team the same way (see analysisService/LiveScorePage).
 */
export function teamKey(name: string): string {
  return normName(name);
}

function isFlashMatch(m: unknown): m is FlashMatch {
  return (
    !!m &&
    typeof m === 'object' &&
    'home_team' in m &&
    'away_team' in m &&
    'match_id' in m &&
    !!(m as FlashMatch).home_team?.name &&
    !!(m as FlashMatch).away_team?.name
  );
}

export interface FixtureTeamMatches {
  home: MatchResult[];
  away: MatchResult[];
}

/**
 * Split an h2h payload into the home and away teams' recent MatchResult lists.
 * Friendlies are excluded; each list is deduped by id and newest-first, capped.
 */
export function flashscoreFixtureMatches(
  input: unknown,
  home: Team,
  away: Team,
): FixtureTeamMatches {
  const all = toMatchArray(input).filter(isFlashMatch);
  const hN = normName(home.name);
  const aN = normName(away.name);

  // Every team (subjects and opponents) is keyed by its normalized name, so the
  // result is independent of the caller's fixture ids and safe to share via the
  // match-id-keyed cache. Consumers re-key their fixture teams via `teamKey`.
  const idFor = (name: string): string => normName(name);

  const toResult = (m: FlashMatch): MatchResult | null => {
    const [hg, ag] = goalsOf(m);
    if (hg === null || ag === null) return null;
    const ts = typeof m.timestamp === 'number' ? m.timestamp : 0;
    return {
      id: m.match_id,
      date: ts ? new Date(ts * 1000).toISOString() : '',
      home: { id: idFor(m.home_team.name), name: m.home_team.name },
      away: { id: idFor(m.away_team.name), name: m.away_team.name },
      homeGoals: hg,
      awayGoals: ag,
    };
  };

  const forTeam = (teamName: string): MatchResult[] => {
    const byId = new Map<string, MatchResult>();
    for (const m of all) {
      if (isFriendly(m)) continue;
      const involved =
        normName(m.home_team.name) === teamName || normName(m.away_team.name) === teamName;
      if (!involved) continue;
      const r = toResult(m);
      if (r && !byId.has(r.id)) byId.set(r.id, r);
    }
    return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT);
  };

  return { home: forTeam(hN), away: forTeam(aN) };
}
