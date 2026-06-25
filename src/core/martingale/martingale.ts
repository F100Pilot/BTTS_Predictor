import type { Bet, MartingaleStats } from '@/domain/types';
import { round, safeDivide } from '@/lib/math';

/**
 * Core Martingale stake formula (ported from the martingale-app):
 *   stake = (accumulatedLoss + baseProfit) / (odds - 1)
 * A single winning bet at these odds recovers the whole series' losses and
 * secures `baseProfit`. Returns 0 for non-positive odds margins.
 */
export function calculateStake(currentLoss: number, baseProfit: number, odds: number): number {
  if (odds <= 1) return 0;
  const stake = safeDivide(currentLoss + baseProfit, odds - 1, 0);
  return round(Math.max(0, stake), 2);
}

/** Net profit of a winning bet (gross return minus stake). */
export function winProfit(stake: number, odds: number): number {
  return round(stake * odds - stake, 2);
}

/**
 * Derive the active series state (accumulated loss + step) from bet history.
 * A win resets the series; bets created on/before `seriesResetAt` are ignored
 * (manual "reset series"). Fully derived → robust to edits/deletes/re-settles.
 */
export function activeSeries(
  bets: Bet[],
  seriesResetAt = 0,
): { currentLoss: number; step: number } {
  const settled = bets
    .filter((b) => b.result !== 'pending' && b.createdAt > seriesResetAt)
    .sort((a, b) => (a.settledAt ?? a.createdAt) - (b.settledAt ?? b.createdAt));

  let currentLoss = 0;
  let step = 1;
  for (const bet of settled) {
    if (bet.result === 'won') {
      currentLoss = 0;
      step = 1;
    } else {
      currentLoss = round(currentLoss + bet.stake, 2);
      step += 1;
    }
  }
  return { currentLoss, step };
}

export interface ProjectionStep {
  step: number;
  stake: number;
  /** Total accumulated loss if this step also loses. */
  cumulativeLoss: number;
}

/**
 * Project the next `steps` stakes assuming consecutive losses at fixed odds,
 * starting from the current series state. Lets the user see the risk grow
 * before committing to a bet.
 */
export function projectSeries(
  currentLoss: number,
  baseProfit: number,
  odds: number,
  fromStep: number,
  steps: number,
): ProjectionStep[] {
  const out: ProjectionStep[] = [];
  let loss = currentLoss;
  for (let i = 0; i < steps; i++) {
    const stake = calculateStake(loss, baseProfit, odds);
    loss = round(loss + stake, 2);
    out.push({ step: fromStep + i, stake, cumulativeLoss: loss });
  }
  return out;
}

/** Aggregate statistics + equity curve from a list of bets.
 * `initialBankroll` is the starting balance; current bankroll = start + profit. */
export function computeStats(bets: Bet[], initialBankroll: number): MartingaleStats {
  const settled = bets
    .filter((b) => b.result !== 'pending')
    .sort((a, b) => (a.settledAt ?? a.createdAt) - (b.settledAt ?? b.createdAt));

  let totalStaked = 0;
  let totalProfit = 0;
  let wins = 0;
  let losses = 0;
  let maxStake = 0;
  let lossStreak = 0;
  let maxLossStreak = 0;
  const equity: MartingaleStats['equity'] = [];

  settled.forEach((bet, i) => {
    totalStaked += bet.stake;
    maxStake = Math.max(maxStake, bet.stake);
    if (bet.result === 'won') {
      totalProfit += winProfit(bet.stake, bet.odds);
      wins += 1;
      lossStreak = 0;
    } else {
      totalProfit -= bet.stake;
      losses += 1;
      lossStreak += 1;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    }
    equity.push({ index: i + 1, profit: round(totalProfit, 2), label: `#${i + 1}` });
  });

  const pending = bets.length - settled.length;
  const settledCount = wins + losses;

  return {
    bankroll: round(initialBankroll + totalProfit, 2),
    totalStaked: round(totalStaked, 2),
    totalProfit: round(totalProfit, 2),
    roi: round(safeDivide(totalProfit, totalStaked, 0) * 100, 1),
    wins,
    losses,
    pending,
    winrate: round(safeDivide(wins, settledCount, 0) * 100, 1),
    maxLossStreak,
    maxStake: round(maxStake, 2),
    equity,
  };
}
