import type { MarketPrediction, TeamStats } from '@/domain/types';
import { clamp, round } from '@/lib/math';
import { MARKETS_HOME_ADVANTAGE as HOME_ADVANTAGE, DIXON_COLES_RHO } from './constants';

/** Poisson PMF. */
function pmf(k: number, lambda: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * lambda ** k) / fact;
}

/**
 * Dixon-Coles low-score correction τ(h,a): scales the four dependent low-score
 * cells of the otherwise-independent Poisson score matrix. With ρ<0 it lifts
 * 0-0 and 1-1 and trims 1-0 / 0-1 (all other cells unchanged). Clamped to ≥0 so
 * extreme λ can never produce a negative probability.
 */
function dixonColesTau(
  h: number,
  a: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number {
  let tau = 1;
  if (h === 0 && a === 0) tau = 1 - lambdaHome * lambdaAway * rho;
  else if (h === 0 && a === 1) tau = 1 + lambdaHome * rho;
  else if (h === 1 && a === 0) tau = 1 + lambdaAway * rho;
  else if (h === 1 && a === 1) tau = 1 - rho;
  return Math.max(0, tau);
}

/** Expected goals for each side from recent attack vs opponent defence (last 10). */
export function expectedGoals(
  home: TeamStats,
  away: TeamStats,
): { lambdaHome: number; lambdaAway: number } {
  const lambdaHome = Math.max(
    0.05,
    ((home.last10.avgGoalsFor + away.last10.avgGoalsAgainst) / 2) * HOME_ADVANTAGE,
  );
  const lambdaAway = Math.max(0.05, (away.last10.avgGoalsFor + home.last10.avgGoalsAgainst) / 2);
  return { lambdaHome: round(lambdaHome, 3), lambdaAway: round(lambdaAway, 3) };
}

/**
 * Derive Over/Under 2.5 and 1X2 probabilities from a Dixon-Coles-adjusted
 * bivariate Poisson model (independent Poisson per team + low-score dependence
 * correction). Both markets are read off a single normalized score matrix so
 * they stay mutually consistent. Reuses the same expected-goals basis as BTTS.
 */
export function predictMarkets(home: TeamStats, away: TeamStats): MarketPrediction {
  const { lambdaHome, lambdaAway } = expectedGoals(home, away);

  // Build the Dixon-Coles-adjusted joint score matrix up to 8 goals per side,
  // then read Over/Under 2.5 and 1X2 off it. τ only touches the four low-score
  // cells, so it slightly shifts the total mass — normalize by the full sum.
  const MAX = 8;
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let under = 0; // total goals ≤ 2
  let total = 0;
  for (let h = 0; h <= MAX; h++) {
    const ph = pmf(h, lambdaHome);
    for (let a = 0; a <= MAX; a++) {
      const p =
        ph * pmf(a, lambdaAway) * dixonColesTau(h, a, lambdaHome, lambdaAway, DIXON_COLES_RHO);
      total += p;
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h + a <= 2) under += p;
    }
  }
  const t = total || 1;
  const under25 = clamp(under / t);

  return {
    lambdaHome,
    lambdaAway,
    over25: round(1 - under25, 4),
    under25: round(under25, 4),
    homeWin: round(homeWin / t, 4),
    draw: round(draw / t, 4),
    awayWin: round(awayWin / t, 4),
  };
}
