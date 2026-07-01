import type { BttsPrediction, MarketPrediction } from '@/domain/types';

/** The betting markets the app can show/track, kept strictly separate. */
export type MarketKey = 'btts' | 'ou25' | 'x12';

export interface MarketOption {
  key: MarketKey;
  /** Full label (menus, history). */
  label: string;
  /** Short label (segmented control). */
  short: string;
}

export const MARKETS: MarketOption[] = [
  { key: 'btts', label: 'Ambas marcam (BTTS)', short: 'BTTS' },
  { key: 'ou25', label: 'Mais/Menos 2.5 golos', short: 'O/U 2.5' },
  { key: 'x12', label: 'Resultado (1X2)', short: '1X2' },
];

export function marketLabel(market: MarketKey): string {
  return MARKETS.find((m) => m.key === market)?.label ?? market;
}

/** The selectable outcomes of each market (for Martingale bets). */
export const MARKET_SIDES: Record<MarketKey, string[]> = {
  btts: ['SIM', 'NÃO'],
  ou25: ['Over 2.5', 'Under 2.5'],
  x12: ['Casa', 'Empate', 'Fora'],
};

/** Visual tone of a pick: a "good/yes" side, a "bad/no" side, or neutral (1X2). */
export type Tone = 'pos' | 'neg' | 'neutral';

export interface MarketPick {
  /** Human side label, e.g. "SIM" / "Over" / "Casa". */
  side: string;
  /** Probability of the chosen (dominant) side, 0..1. */
  probability: number;
  tone: Tone;
}

/**
 * The dominant pick for a market from the model outputs. BTTS comes from the
 * full (calibrated) BttsPrediction; Over/Under and 1X2 from the Poisson
 * MarketPrediction. Returns null when the needed data is missing.
 */
export function marketPick(
  market: MarketKey,
  btts: BttsPrediction | undefined,
  markets: MarketPrediction | undefined,
): MarketPick | null {
  if (market === 'btts') {
    if (!btts) return null;
    return btts.probYes >= 0.5
      ? { side: 'SIM', probability: btts.probYes, tone: 'pos' }
      : { side: 'NÃO', probability: btts.probNo, tone: 'neg' };
  }
  if (!markets) return null;
  if (market === 'ou25') {
    return markets.over25 >= markets.under25
      ? { side: 'Over 2.5', probability: markets.over25, tone: 'pos' }
      : { side: 'Under 2.5', probability: markets.under25, tone: 'neg' };
  }
  // 1X2 — pick the most likely of the three (always neutral tone).
  const options: Array<{ side: string; p: number }> = [
    { side: 'Casa', p: markets.homeWin },
    { side: 'Empate', p: markets.draw },
    { side: 'Fora', p: markets.awayWin },
  ];
  const best = options.reduce((a, b) => (b.p > a.p ? b : a));
  return { side: best.side, probability: best.p, tone: 'neutral' };
}

/** The actual winning side of a market from a final scoreline. */
export function marketActualSide(market: MarketKey, homeGoals: number, awayGoals: number): string {
  if (market === 'btts') return homeGoals > 0 && awayGoals > 0 ? 'SIM' : 'NÃO';
  if (market === 'ou25') return homeGoals + awayGoals > 2.5 ? 'Over 2.5' : 'Under 2.5';
  return homeGoals > awayGoals ? 'Casa' : homeGoals < awayGoals ? 'Fora' : 'Empate';
}

/** Whether a market pick was correct against a final scoreline. */
export function marketPickCorrect(
  market: MarketKey,
  pickSide: string,
  homeGoals: number,
  awayGoals: number,
): boolean {
  return pickSide === marketActualSide(market, homeGoals, awayGoals);
}
