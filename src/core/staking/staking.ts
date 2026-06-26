import { round } from '@/lib/math';

/** Supported staking strategies. */
export type StakingStrategy = 'flat' | 'kelly' | 'percent';

export interface StakeInput {
  /** Current bankroll. */
  bankroll: number;
  /** Decimal odds of the selection. */
  odds: number;
  /** Estimated win probability (0..1) — used by Kelly. */
  probability: number;
  /** Flat stake amount (for the flat strategy). */
  flatStake: number;
  /** Percentage of bankroll, 0..100 (for percent / Kelly cap). */
  percent: number;
  /** Kelly fraction, 0..1 (1 = full Kelly, 0.5 = half Kelly). */
  kellyFraction: number;
}

/**
 * Kelly criterion fraction of bankroll to stake:
 *   f* = (b·p − q) / b , where b = odds − 1, q = 1 − p.
 * Returns 0 when there is no edge (never stake on a negative-EV bet).
 */
export function kellyFraction(odds: number, probability: number): number {
  const b = odds - 1;
  if (b <= 0) return 0;
  const q = 1 - probability;
  const f = (b * probability - q) / b;
  return f > 0 ? f : 0;
}

/**
 * Suggested stake for a strategy, always clamped to the bankroll and to the
 * configured percentage cap (a safety brake against oversized bets).
 */
export function suggestStake(strategy: StakingStrategy, input: StakeInput): number {
  const { bankroll, odds, probability, flatStake, percent, kellyFraction: kf } = input;
  const cap = bankroll * (Math.max(0, percent) / 100);
  let stake = 0;
  switch (strategy) {
    case 'flat':
      stake = flatStake;
      break;
    case 'percent':
      stake = cap;
      break;
    case 'kelly':
      stake = Math.min(bankroll * kellyFraction(odds, probability) * kf, cap || Infinity);
      break;
  }
  stake = Math.max(0, Math.min(stake, bankroll));
  return round(stake, 2);
}

export interface StakeSuggestion {
  strategy: StakingStrategy;
  label: string;
  stake: number;
  /** Expected value of the bet at this stake (can be negative). */
  ev: number;
}

const LABELS: Record<StakingStrategy, string> = {
  flat: 'Fixa (flat)',
  percent: '% da banca',
  kelly: 'Kelly',
};

/** Expected value of staking `stake` at `odds` with win probability `p`. */
export function expectedValue(stake: number, odds: number, probability: number): number {
  const win = stake * (odds - 1);
  return round(probability * win - (1 - probability) * stake, 2);
}

/** Compute every strategy's suggestion side-by-side for comparison. */
export function compareStrategies(input: StakeInput): StakeSuggestion[] {
  return (['flat', 'percent', 'kelly'] as StakingStrategy[]).map((strategy) => {
    const stake = suggestStake(strategy, input);
    return {
      strategy,
      label: LABELS[strategy],
      stake,
      ev: expectedValue(stake, input.odds, input.probability),
    };
  });
}
