/** Minimum match history before a factor is considered trustworthy. */
export const MIN_MATCHES = 3;

/** How many recent matches to fetch per team (last5 + last10 windows + H2H pool). */
export const MAX_RECENT_MATCHES = 15;

/** Neutral probability used when a factor has no underlying data ("don't know"). */
export const NEUTRAL = 0.5;

/** Mild home-scoring boost in the BTTS prediction engine. */
export const HOME_ADVANTAGE = 1.05;

/** Home-scoring boost in the markets (Over/Under 2.5, 1X2) Poisson model. */
export const MARKETS_HOME_ADVANTAGE = 1.1;

/**
 * Half-life (in days) for the recency weighting of recent matches and H2H: a
 * result this old counts half as much as a brand-new one. ~6 months keeps a
 * full season relevant while clearly favouring current form.
 */
export const FORM_HALF_LIFE_DAYS = 180;

/**
 * Empirical-Bayes shrinkage strength: how many "pseudo-matches" of the league
 * prior are mixed into a team's own rates. With k=4, a 3-game sample is ~43%
 * its own data / 57% prior; a 10-game sample is ~71% its own. Tames noisy
 * early-season / thin samples without washing out established teams.
 */
export const PRIOR_STRENGTH = 4;

/**
 * League-average priors the small-sample rates are shrunk toward (typical
 * top-division values: ~2.7 goals/game, ~52% BTTS).
 */
export const LEAGUE_PRIORS = {
  avgGoalsFor: 1.35,
  avgGoalsAgainst: 1.35,
  bttsPct: 0.52,
  over25Pct: 0.52,
  cleanSheetPct: 0.27,
  failedToScorePct: 0.27,
} as const;
