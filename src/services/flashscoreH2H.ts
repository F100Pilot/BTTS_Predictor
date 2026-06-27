/**
 * Compute BTTS-relevant stats from a Flashscore "match h2h" response.
 *
 * That endpoint returns a flat array mixing: the home team's recent games, the
 * away team's recent games, and the two teams' head-to-head history — each item
 * carrying the final score. From the scores alone we derive goal averages,
 * BTTS% (home/away splits) and the H2H BTTS% — everything the Calculator needs,
 * in a single call.
 */

export interface FlashMatch {
  match_id: string;
  timestamp: number;
  status?: string;
  tournament_name?: string;
  home_team: { name: string; score: string | number };
  away_team: { name: string; score: string | number };
}

/** One venue split (overall / home / away). bttsPct is 0–100. */
export interface FlashSplit {
  played: number;
  goalsFor: number; // average per game
  goalsAgainst: number; // average per game
  bttsPct: number;
}

export interface FlashTeam {
  name: string;
  overall: FlashSplit;
  home: FlashSplit;
  away: FlashSplit;
}

export interface FlashH2HResult {
  teams: [FlashTeam, FlashTeam];
  h2h: { played: number; bttsPct: number };
}

const RECENT = 10; // games per form window
const EMPTY: FlashSplit = { played: 0, goalsFor: 0, goalsAgainst: 0, bttsPct: 0 };

function toGoals(v: string | number): number | null {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function isFriendly(m: FlashMatch): boolean {
  return /friendly/i.test(m.tournament_name ?? '');
}

/** Dedupe by match_id, newest first. */
function dedupeSorted(matches: FlashMatch[]): FlashMatch[] {
  const byId = new Map<string, FlashMatch>();
  for (const m of matches) if (!byId.has(m.match_id)) byId.set(m.match_id, m);
  return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp);
}

/** Build a split for `team` over the given matches (already venue-filtered). */
function buildSplit(matches: FlashMatch[], team: string): FlashSplit {
  let played = 0;
  let gf = 0;
  let ga = 0;
  let btts = 0;
  for (const m of matches.slice(0, RECENT)) {
    const hs = toGoals(m.home_team.score);
    const as = toGoals(m.away_team.score);
    if (hs === null || as === null) continue;
    const isHome = m.home_team.name === team;
    const teamGoals = isHome ? hs : as;
    const oppGoals = isHome ? as : hs;
    played += 1;
    gf += teamGoals;
    ga += oppGoals;
    if (hs >= 1 && as >= 1) btts += 1;
  }
  if (played === 0) return { ...EMPTY };
  return {
    played,
    goalsFor: round2(gf / played),
    goalsAgainst: round2(ga / played),
    bttsPct: Math.round((btts / played) * 100),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function teamMatches(
  all: FlashMatch[],
  team: string,
  venue: 'all' | 'home' | 'away',
): FlashMatch[] {
  return all.filter((m) => {
    if (isFriendly(m)) return false;
    if (venue === 'home') return m.home_team.name === team;
    if (venue === 'away') return m.away_team.name === team;
    return m.home_team.name === team || m.away_team.name === team;
  });
}

function buildTeam(all: FlashMatch[], team: string): FlashTeam {
  return {
    name: team,
    overall: buildSplit(dedupeSorted(teamMatches(all, team, 'all')), team),
    home: buildSplit(dedupeSorted(teamMatches(all, team, 'home')), team),
    away: buildSplit(dedupeSorted(teamMatches(all, team, 'away')), team),
  };
}

/**
 * Identify the two subject teams. The pure H2H rows (Flashscore marks them with
 * an empty `status`) only ever contain the two teams of interest; fall back to
 * the two most frequent names when that block is absent.
 */
function subjectTeams(all: FlashMatch[]): [string, string] | null {
  const h2hRows = all.filter((m) => (m.status ?? '') === '');
  const names = new Set<string>();
  for (const m of h2hRows) {
    names.add(m.home_team.name);
    names.add(m.away_team.name);
  }
  if (names.size === 2) return [...names] as [string, string];

  // Fallback: two most common team names across all rows.
  const freq = new Map<string, number>();
  for (const m of all) {
    freq.set(m.home_team.name, (freq.get(m.home_team.name) ?? 0) + 1);
    freq.set(m.away_team.name, (freq.get(m.away_team.name) ?? 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  return top.length >= 2 ? [top[0]!, top[1]!] : null;
}

/** BTTS% and count for matches between exactly the two given teams. */
function buildH2H(all: FlashMatch[], a: string, b: string): { played: number; bttsPct: number } {
  const between = dedupeSorted(
    all.filter((m) => {
      const names = [m.home_team.name, m.away_team.name];
      return names.includes(a) && names.includes(b);
    }),
  ).slice(0, RECENT);
  let played = 0;
  let btts = 0;
  for (const m of between) {
    const hs = toGoals(m.home_team.score);
    const as = toGoals(m.away_team.score);
    if (hs === null || as === null) continue;
    played += 1;
    if (hs >= 1 && as >= 1) btts += 1;
  }
  return { played, bttsPct: played ? Math.round((btts / played) * 100) : 0 };
}

/**
 * Parse a Flashscore h2h array into both teams' splits + their H2H. Returns null
 * when the input isn't a usable match array.
 */
export function parseFlashscoreH2H(input: unknown): FlashH2HResult | null {
  if (!Array.isArray(input)) return null;
  const all = input.filter(
    (m): m is FlashMatch =>
      !!m && typeof m === 'object' && 'home_team' in m && 'away_team' in m && 'match_id' in m,
  );
  if (all.length === 0) return null;
  const teams = subjectTeams(all);
  if (!teams) return null;
  return {
    teams: [buildTeam(all, teams[0]), buildTeam(all, teams[1])],
    h2h: buildH2H(all, teams[0], teams[1]),
  };
}
