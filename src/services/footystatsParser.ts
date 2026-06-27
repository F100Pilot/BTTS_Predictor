/**
 * Parser for FootyStats club pages (e.g. footystats.org/clubs/<team>).
 *
 * The app cannot fetch these pages directly (CORS + anti-bot + ToS), so the
 * user copies the page source and pastes it. This module turns that raw HTML
 * into the goals/BTTS/games-played splits the manual Calculator needs.
 *
 * FootyStats renders its stats in regular `comparison-table-table` tables whose
 * rows are `<td class="item key">LABEL</td>` followed by three stat cells in the
 * order Overall · At Home · At Away. We key off the row labels, which are far
 * more stable than the surrounding CSS classes.
 */

/** One venue split (overall / home / away) extracted from a club page. */
export interface ParsedTeamSplit {
  /** Matches played in this split. */
  played: number;
  /** Average goals scored per match. */
  goalsFor: number;
  /** Average goals conceded per match. */
  goalsAgainst: number;
  /** Both-teams-to-score rate, 0–100. */
  bttsPct: number;
}

export interface ParsedFootystatsTeam {
  name: string;
  overall: ParsedTeamSplit;
  home: ParsedTeamSplit;
  away: ParsedTeamSplit;
}

/** Parse a numeric cell, tolerating "%", spaces and stray characters. */
function num(raw: string | null | undefined): number {
  if (!raw) return 0;
  const v = parseFloat(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(v) ? v : 0;
}

/**
 * Find a stats row by its label and return the [overall, home, away] cells.
 * Matches the first row whose key cell text equals `label` (case-insensitive).
 */
function findRow(doc: Document, label: string): [number, number, number] | null {
  const target = label.toLowerCase();
  const keys = Array.from(doc.querySelectorAll('td.item.key, th.item.key'));
  for (const key of keys) {
    if ((key.textContent ?? '').trim().toLowerCase() !== target) continue;
    const stats: number[] = [];
    let sib = key.nextElementSibling;
    while (sib && stats.length < 3) {
      if (sib.classList.contains('stat')) stats.push(num(sib.textContent));
      sib = sib.nextElementSibling;
    }
    if (stats.length === 3) {
      const [a, b, c] = stats;
      return [a ?? 0, b ?? 0, c ?? 0];
    }
  }
  return null;
}

/**
 * Find a stats row in PLAIN TEXT (the page's visible text, e.g. copied on a
 * phone via "Select all"). Matches a label followed by three numbers, tolerating
 * "%" suffixes and any whitespace (incl. newlines/tabs) between cells.
 */
function findRowText(text: string, label: string): [number, number, number] | null {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${esc}\\s+(-?[\\d.]+)%?\\s+(-?[\\d.]+)%?\\s+(-?[\\d.]+)%?`, 'i');
  const m = re.exec(text);
  if (!m) return null;
  return [num(m[1]), num(m[2]), num(m[3])];
}

/** Pick column `i` (0 overall, 1 home, 2 away) from a row, defaulting to 0. */
function col(row: [number, number, number] | null, i: number): number {
  return row ? (row[i] ?? 0) : 0;
}

/**
 * Parse a FootyStats club page. Accepts EITHER the page source (HTML) — best on
 * desktop via "view source" — OR the page's visible text copied with "Select
 * all" (the practical route on a phone, where there's no view-source). Returns
 * null when the input has no recognisable stats rows.
 */
export function parseFootystatsClub(input: string): ParsedFootystatsTeam | null {
  if (!input || typeof input !== 'string') return null;
  const doc = new DOMParser().parseFromString(input, 'text/html');
  // For the plain-text route, the rendered text (with its whitespace) is the
  // original input itself; entities are already decoded there.
  const text = input;

  // Try the structured HTML row first, then fall back to plain-text matching.
  const get = (...labels: string[]): [number, number, number] | null => {
    for (const l of labels) {
      const r = findRow(doc, l);
      if (r) return r;
    }
    for (const l of labels) {
      const r = findRowText(text, l);
      if (r) return r;
    }
    return null;
  };

  const scored = get('Scored / Match');
  const conceded = get('Conceded / Match');
  // The model only really needs goals; bail only when those are missing.
  if (!scored && !conceded) return null;

  const btts = get('BTTS %', 'BTTS');
  const played = get('Matches Played');

  // Team name: FootyStats sets `var zz = '<Team>'`; fall back to the OG title.
  let name = '';
  const zz = /\bvar\s+zz\s*=\s*'([^']+)'/.exec(input);
  if (zz?.[1]) name = zz[1].trim();
  if (!name) {
    const og = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '';
    name = og.replace(/\s*Stats.*$/i, '').trim();
  }

  const split = (i: number): ParsedTeamSplit => ({
    played: Math.round(col(played, i)),
    goalsFor: col(scored, i),
    goalsAgainst: col(conceded, i),
    bttsPct: col(btts, i),
  });

  return { name, overall: split(0), home: split(1), away: split(2) };
}
