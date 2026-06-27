import type { Bet, BetResult } from '@/domain/types';

export type BttsOutcome = 'yes' | 'no';

/** BTTS outcome from a final (or current) scoreline. */
export function bttsFromGoals(homeGoals: number, awayGoals: number): BttsOutcome {
  return homeGoals > 0 && awayGoals > 0 ? 'yes' : 'no';
}

const SEL_YES = /\b(sim|yes)\b/i;
const SEL_NO = /\b(n[aã]o|no)\b/i;
const MARKET_BTTS = /btts|ambas|both/i;

/**
 * Grade a bet against the actual BTTS outcome. Returns 'won' | 'lost', or
 * `null` when the bet is not an auto-gradable BTTS bet (unknown market or an
 * ambiguous selection) — those are left for the user to settle manually.
 */
export function settleBetAgainstBtts(bet: Bet, outcome: BttsOutcome): BetResult | null {
  const backedNo = SEL_NO.test(bet.selection);
  const backedYes = SEL_YES.test(bet.selection);
  // Need a clear BTTS context: either an explicit yes/no selection, or a BTTS
  // market with a yes/no selection. Anything else we can't grade safely.
  if (!backedNo && !backedYes) return null;
  if (!MARKET_BTTS.test(bet.market) && !backedNo && !backedYes) return null;
  const actualYes = outcome === 'yes';
  const won = backedYes ? actualYes : !actualYes;
  return won ? 'won' : 'lost';
}
