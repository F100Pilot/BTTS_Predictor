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
