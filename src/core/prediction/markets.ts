import type { MarketPrediction, TeamStats } from '@/domain/types';
import { clamp, round } from '@/lib/math';

const HOME_ADVANTAGE = 1.1;

/** Poisson PMF. */
function pmf(k: number, lambda: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * lambda ** k) / fact;
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
 * Derive Over/Under 2.5 and 1X2 probabilities from a bivariate Poisson model
 * (independent Poisson per team). Reuses the same expected-goals basis as BTTS.
 */
export function predictMarkets(home: TeamStats, away: TeamStats): MarketPrediction {
  const { lambdaHome, lambdaAway } = expectedGoals(home, away);

  // Over/Under 2.5 — sum of independent Poissons is Poisson(λH+λA).
  const lambdaTotal = lambdaHome + lambdaAway;
  const pUnder = pmf(0, lambdaTotal) + pmf(1, lambdaTotal) + pmf(2, lambdaTotal);
  const over25 = clamp(1 - pUnder);

  // 1X2 — score matrix up to 8 goals per side.
  const MAX = 8;
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  for (let h = 0; h <= MAX; h++) {
    const ph = pmf(h, lambdaHome);
    for (let a = 0; a <= MAX; a++) {
      const p = ph * pmf(a, lambdaAway);
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
    }
  }
  const total = homeWin + draw + awayWin || 1;

  return {
    lambdaHome,
    lambdaAway,
    over25: round(over25, 4),
    under25: round(clamp(pUnder), 4),
    homeWin: round(homeWin / total, 4),
    draw: round(draw / total, 4),
    awayWin: round(awayWin / total, 4),
  };
}
