/**
 * Decide BTTS results from Flashscore fixtures (live or by-date) and match them
 * to stored history/bets. A finished fixture yields the final BTTS outcome; a
 * live fixture where both teams have already scored locks an early "yes" (BTTS
 * can never revert to "no" once both have scored). Anything else isn't settleable
 * yet (a 0-0 or 1-0 in play could still go either way).
 */

import type { FlashFixture } from './flashscoreMatches';
import { bttsFromGoals, type BttsOutcome } from './settlementService';

export interface FlashSettleOutcome {
  outcome: BttsOutcome;
  /** Final/most-recent scoreline, e.g. "2-1". */
  score: string;
}

/** Settleable outcome for a fixture, or null when it can't be settled yet. */
export function flashOutcome(f: FlashFixture): FlashSettleOutcome | null {
  const { home, away } = f.scores;
  if (home == null || away == null) return null;
  const score = `${home}-${away}`;
  if (f.status === 'finished') return { outcome: bttsFromGoals(home, away), score };
  // In play: only "yes" is final once both teams have scored.
  if (home >= 1 && away >= 1) return { outcome: 'yes', score };
  return null;
}

export interface FlashGoals {
  home: number;
  away: number;
  finished: boolean;
  /** Scoreline "2-1" (only final when `finished`). */
  score: string;
}

/** Current goals of a fixture, for market-aware bet settling (BTTS / O-U / 1X2
 * grade differently, so the caller needs the raw score + finished flag rather
 * than the BTTS-only `flashOutcome`). Null when the feed has no score yet. */
export function flashGoals(f: FlashFixture): FlashGoals | null {
  const { home, away } = f.scores;
  if (home == null || away == null) return null;
  return { home, away, finished: f.status === 'finished', score: `${home}-${away}` };
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function namesKey(home: string, away: string): string {
  return `${norm(home)}|${norm(away)}`;
}

/** Split a "Home vs Away" label into its two team names. */
export function splitFixtureName(name: string): [string, string] | null {
  const parts = name.split(/\s+vs\.?\s+/i);
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0].trim(), parts[1].trim()] : null;
}

export interface FixtureIndex {
  /** Find a fixture by Flashscore match id first, then by team-name pair. */
  find: (flashMatchId: string | undefined, label: string) => FlashFixture | undefined;
  size: number;
}

/** Build lookups (by match id, by normalized team-name pair) over fixtures. */
export function buildFixtureIndex(fixtures: FlashFixture[]): FixtureIndex {
  const byId = new Map<string, FlashFixture>();
  const byNames = new Map<string, FlashFixture>();
  for (const f of fixtures) {
    byId.set(f.matchId, f);
    byNames.set(namesKey(f.home.name, f.away.name), f);
  }
  return {
    size: fixtures.length,
    find: (flashMatchId, label) => {
      if (flashMatchId) {
        const byMatch = byId.get(flashMatchId);
        if (byMatch) return byMatch;
      }
      const names = splitFixtureName(label);
      return names ? byNames.get(namesKey(names[0], names[1])) : undefined;
    },
  };
}
