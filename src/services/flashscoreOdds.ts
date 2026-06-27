/**
 * Extract Both-Teams-To-Score (BTTS) odds from a Flashscore "match odds"
 * response. That endpoint returns an array of bookmakers, each with a list of
 * market groups ({bettingType, bettingScope, odds[]}). For the full-time BTTS
 * market each bookmaker exposes two lines: `bothTeamsToScore: true` (odd for
 * "Yes") and `false` (odd for "No"). We average across bookmakers to get a
 * market-consensus Yes/No pair the Calculator can blend into its prediction.
 */

export interface FlashBttsOdds {
  /** Average decimal odd for BTTS Yes (full time). */
  yes: number;
  /** Average decimal odd for BTTS No (full time). */
  no: number;
  /** How many bookmakers contributed a complete Yes/No pair. */
  bookmakers: number;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Coerce wrapped payloads ({data|response|result: [...]}) into the array. */
function toBookmakerArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return [];
  for (const v of Object.values(input as Record<string, unknown>)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

/**
 * Parse full-time BTTS odds, averaged across all bookmakers. Returns null when
 * no bookmaker offers a complete Yes/No pair.
 */
export function parseFlashscoreBttsOdds(input: unknown): FlashBttsOdds | null {
  const books = toBookmakerArray(input);
  const yesOdds: number[] = [];
  const noOdds: number[] = [];

  for (const book of books) {
    if (!book || typeof book !== 'object') continue;
    const markets = (book as { odds?: unknown }).odds;
    if (!Array.isArray(markets)) continue;

    let bookYes: number | null = null;
    let bookNo: number | null = null;
    for (const market of markets) {
      if (!market || typeof market !== 'object') continue;
      const m = market as { bettingType?: string; bettingScope?: string; odds?: unknown };
      if (m.bettingType !== 'BOTH_TEAMS_TO_SCORE' || m.bettingScope !== 'FULL_TIME') continue;
      if (!Array.isArray(m.odds)) continue;
      for (const line of m.odds) {
        if (!line || typeof line !== 'object') continue;
        const l = line as { value?: unknown; bothTeamsToScore?: unknown };
        const v = num(l.value);
        if (v === null) continue;
        if (l.bothTeamsToScore === true) bookYes = v;
        else if (l.bothTeamsToScore === false) bookNo = v;
      }
    }
    if (bookYes !== null && bookNo !== null) {
      yesOdds.push(bookYes);
      noOdds.push(bookNo);
    }
  }

  if (yesOdds.length === 0 || noOdds.length === 0) return null;
  const avg = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
  return {
    yes: round2(avg(yesOdds)),
    no: round2(avg(noOdds)),
    bookmakers: yesOdds.length,
  };
}
