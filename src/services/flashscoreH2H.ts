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
  status?: string | null;
  tournament_name?: string;
  home_team: { name: string; score?: string | number };
  away_team: { name: string; score?: string | number };
  /** Newer endpoint shape: final score lives here instead of on the teams. */
  scores?: { home?: string | number | null; away?: string | number | null };
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

function toGoals(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Final score as [home, away]. Supports both response shapes: the score on a
 * top-level `scores` object, or on the team objects (`home_team.score`).
 */
function goalsOf(m: FlashMatch): [number | null, number | null] {
  return [
    toGoals(m.scores?.home ?? m.home_team.score),
    toGoals(m.scores?.away ?? m.away_team.score),
  ];
}

function isFriendly(m: FlashMatch): boolean {
  return /friendly/i.test(m.tournament_name ?? '');
}

/** Normalize a team name for matching (trim + collapse inner whitespace). */
function normName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * Coerce an unknown payload into a flat array of match-like objects. Handles the
 * plain array, common RapidAPI wrappers ({data|response|result|matches: [...]}),
 * and section objects ({home_form, away_form, h2h: [...]}) by concatenating every
 * nested array of objects we find one level deep.
 */
function toMatchArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return [];
  const out: unknown[] = [];
  for (const v of Object.values(input as Record<string, unknown>)) {
    if (Array.isArray(v)) out.push(...v);
  }
  return out;
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
    const [hs, as] = goalsOf(m);
    if (hs === null || as === null) continue;
    const isHome = normName(m.home_team.name) === team;
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
    const home = normName(m.home_team.name);
    const away = normName(m.away_team.name);
    if (venue === 'home') return home === team;
    if (venue === 'away') return away === team;
    return home === team || away === team;
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
  // Older shape marks pure head-to-head rows with an empty status string. The
  // newer shape uses null everywhere, so treat only the empty string as a marker
  // (null means "unknown" → fall back to the frequency heuristic below).
  const h2hRows = all.filter((m) => m.status === '');
  const names = new Set<string>();
  for (const m of h2hRows) {
    names.add(normName(m.home_team.name));
    names.add(normName(m.away_team.name));
  }
  if (names.size === 2) return [...names] as [string, string];

  // Fallback: two most common team names across all rows.
  const freq = new Map<string, number>();
  for (const m of all) {
    const home = normName(m.home_team.name);
    const away = normName(m.away_team.name);
    freq.set(home, (freq.get(home) ?? 0) + 1);
    freq.set(away, (freq.get(away) ?? 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  return top.length >= 2 ? [top[0]!, top[1]!] : null;
}

/** BTTS% and count for matches between exactly the two given teams. */
function buildH2H(all: FlashMatch[], a: string, b: string): { played: number; bttsPct: number } {
  const between = dedupeSorted(
    all.filter((m) => {
      const names = [normName(m.home_team.name), normName(m.away_team.name)];
      return names.includes(a) && names.includes(b);
    }),
  ).slice(0, RECENT);
  let played = 0;
  let btts = 0;
  for (const m of between) {
    const [hs, as] = goalsOf(m);
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
  const arr = toMatchArray(input);
  if (arr.length === 0) return null;
  const all = arr.filter(
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
