/**
 * Parser for the Flashscore "matches by date" response: an array of tournament
 * groups, each with its matches (ids, teams, scores, 1X2 odds). Used to let the
 * user pick a fixture in the Calculator, then fetch that match's h2h.
 */

export interface FlashFixtureTeam {
  id: string;
  name: string;
}

export interface FlashFixture {
  matchId: string;
  timestamp: number;
  status: 'scheduled' | 'live' | 'finished';
  tournament: string;
  country: string;
  home: FlashFixtureTeam;
  away: FlashFixtureTeam;
  scores: { home: number | null; away: number | null };
  /** Elapsed match minute for a live game, when the feed reports it. */
  minute: number | null;
  /** Match-winner (1X2) odds when present — NOT BTTS odds. */
  odds?: { home: number; draw: number; away: number };
}

function status(m: {
  is_finished?: boolean;
  is_in_progress?: boolean;
  is_started?: boolean;
}): FlashFixture['status'] {
  if (m.is_finished) return 'finished';
  if (m.is_in_progress) return 'live';
  return 'scheduled';
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Best-effort elapsed match minute from the live `match_status` object. Field
 * names vary across the feed, so probe the common ones (number or "67'" string).
 */
function liveMinute(ms: Record<string, unknown>): number | null {
  for (const key of ['minute', 'match_time', 'time', 'minutes', 'current_minute', 'elapsed']) {
    const v = ms[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && /\d/.test(v)) {
      const n = Number.parseInt(v.replace(/[^\d]/g, ''), 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function parseOdds(raw: unknown): FlashFixture['odds'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const home = num(o['1']);
  const draw = num(o['X']);
  const away = num(o['2']);
  if (home === null || draw === null || away === null) return undefined;
  return { home, draw, away };
}

/** Flatten the grouped response into a list of fixtures. */
export function parseFlashscoreMatches(input: unknown): FlashFixture[] {
  if (!Array.isArray(input)) return [];
  const out: FlashFixture[] = [];
  for (const group of input) {
    if (!group || typeof group !== 'object') continue;
    const g = group as {
      name?: string;
      country_name?: string;
      matches?: unknown;
    };
    const tournament = typeof g.name === 'string' ? g.name : '';
    const country = typeof g.country_name === 'string' ? g.country_name : '';
    if (!Array.isArray(g.matches)) continue;
    for (const match of g.matches) {
      if (!match || typeof match !== 'object') continue;
      const m = match as {
        match_id?: string;
        timestamp?: number;
        match_status?: Record<string, unknown>;
        home_team?: { team_id?: string; name?: string };
        away_team?: { team_id?: string; name?: string };
        scores?: { home?: unknown; away?: unknown };
        odds?: unknown;
      };
      if (!m.match_id || !m.home_team?.name || !m.away_team?.name) continue;
      out.push({
        matchId: m.match_id,
        timestamp: typeof m.timestamp === 'number' ? m.timestamp : 0,
        status: status(m.match_status ?? {}),
        tournament,
        country,
        home: { id: m.home_team.team_id ?? '', name: m.home_team.name },
        away: { id: m.away_team.team_id ?? '', name: m.away_team.name },
        scores: { home: num(m.scores?.home), away: num(m.scores?.away) },
        minute: liveMinute(m.match_status ?? {}),
        odds: parseOdds(m.odds),
      });
    }
  }
  return out;
}

/** Convenience: only fixtures that haven't started (useful for predicting). */
export function upcomingOnly(fixtures: FlashFixture[]): FlashFixture[] {
  return fixtures.filter((f) => f.status === 'scheduled').sort((a, b) => a.timestamp - b.timestamp);
}
