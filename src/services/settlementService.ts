import type { Bet, BetResult } from '@/domain/types';
import { marketActualSide, type MarketKey } from '@/core/markets/markets';

export type BttsOutcome = 'yes' | 'no';

/** BTTS outcome from a final (or current) scoreline. */
export function bttsFromGoals(homeGoals: number, awayGoals: number): BttsOutcome {
  return homeGoals > 0 && awayGoals > 0 ? 'yes' : 'no';
}

const SEL_YES = /\b(sim|yes)\b/i;
const SEL_NO = /\b(n[aã]o|no)\b/i;

/** Canonical side of a bet's selection within its market (null = ambiguous). */
function canonicalSide(market: MarketKey, selection: string): string | null {
  if (market === 'btts') {
    if (SEL_NO.test(selection)) return 'NÃO';
    if (SEL_YES.test(selection)) return 'SIM';
    return null;
  }
  if (market === 'ou25') {
    if (/over|mais/i.test(selection)) return 'Over 2.5';
    if (/under|menos/i.test(selection)) return 'Under 2.5';
    return null;
  }
  if (/casa|home/i.test(selection)) return 'Casa';
  if (/empate|draw/i.test(selection)) return 'Empate';
  if (/fora|away/i.test(selection)) return 'Fora';
  return null;
}

/**
 * Grade a bet against a scoreline, per the bet's market (BTTS / O-U 2.5 / 1X2;
 * absent marketKey ⇒ legacy BTTS). With `finished: false` (in-play score) only
 * irreversible outcomes settle early: BTTS once both teams have scored and
 * Over/Under once the total passes 2.5 — 1X2 always waits for full time.
 * Returns 'won' | 'lost', or null when the bet can't be graded safely yet
 * (ambiguous selection, or still undecided in play).
 */
export function settleBetAgainstGoals(
  bet: Bet,
  homeGoals: number,
  awayGoals: number,
  { finished = true }: { finished?: boolean } = {},
): BetResult | null {
  const market: MarketKey = bet.marketKey ?? 'btts';
  const side = canonicalSide(market, bet.selection);
  if (!side) return null;
  if (!finished) {
    if (market === 'btts' && homeGoals >= 1 && awayGoals >= 1)
      return side === 'SIM' ? 'won' : 'lost';
    if (market === 'ou25' && homeGoals + awayGoals >= 3)
      return side === 'Over 2.5' ? 'won' : 'lost';
    return null;
  }
  return side === marketActualSide(market, homeGoals, awayGoals) ? 'won' : 'lost';
}
