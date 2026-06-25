/**
 * Canonical domain model for BTTS Analytics Pro.
 * Every data provider normalizes external data into these types before it
 * reaches the prediction/statistics core.
 */

export type Venue = 'home' | 'away';

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  country?: string;
  crest?: string;
}

export interface Competition {
  id: string;
  name: string;
  country?: string;
  emblem?: string;
}

/** A finished match, normalized. Scores are full-time goals. */
export interface MatchResult {
  id: string;
  date: string; // ISO date
  competitionId?: string;
  competitionName?: string;
  home: Team;
  away: Team;
  homeGoals: number;
  awayGoals: number;
}

/** A scheduled match (today / upcoming). */
export interface Fixture {
  id: string;
  date: string; // ISO date-time
  competition: Competition;
  home: Team;
  away: Team;
  /** Optional bookmaker odds (informational only — not used by the engine). */
  odds?: {
    bttsYes?: number;
    bttsNo?: number;
  };
}

/** A match currently in play (live score). */
export interface LiveMatch {
  id: string;
  competition: Competition;
  home: Team;
  away: Team;
  homeGoals: number;
  awayGoals: number;
  /** Raw status (e.g. IN_PLAY, PAUSED). */
  status: string;
  /** Elapsed minute when available. */
  minute?: number;
}

/** Aggregated statistics over a window of matches for a single team. */
export interface WindowStats {
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  bttsPct: number; // 0..1
  over25Pct: number; // 0..1
  cleanSheetPct: number; // 0..1
  failedToScorePct: number; // 0..1
}

/** Venue-specific aggregated statistics. */
export interface VenueStats {
  played: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  bttsPct: number; // 0..1
}

export interface TeamStats {
  team: Team;
  last5: WindowStats;
  last10: WindowStats;
  home: VenueStats;
  away: VenueStats;
  /** Most recent results first (for form display & charts). */
  recentForm: FormEntry[];
}

export interface FormEntry {
  matchId: string;
  date: string;
  opponent: string;
  venue: Venue;
  goalsFor: number;
  goalsAgainst: number;
  btts: boolean;
  outcome: 'W' | 'D' | 'L';
}

export interface HeadToHead {
  matches: MatchResult[];
  played: number;
  bttsPct: number; // 0..1
  avgGoals: number; // total goals per match
}

export type PredictionTier = 'very-strong' | 'strong' | 'medium' | 'weak';

export interface PredictionFactor {
  key: 'form' | 'bttsHistory' | 'attack' | 'defense' | 'h2h' | 'venue';
  label: string;
  weight: number; // 0..1
  score: number; // 0..1 (probability of BTTS=YES according to this factor)
  contribution: number; // weight * score
}

export interface BttsPrediction {
  probYes: number; // 0..1
  probNo: number; // 0..1
  confidence: number; // 0..10
  tier: PredictionTier;
  factors: PredictionFactor[];
  /** Market-implied BTTS=YES probability (de-vigged), when odds are available. */
  marketImpliedYes?: number;
  /** Calibration weight actually applied to the market probability (0..1). */
  calibrationApplied?: number;
  /** Model probability before any market calibration. */
  modelProbYes?: number;
  /** True when auto-calibration (Platt) adjusted the final probability. */
  recalibrated?: boolean;
}

/** Everything the analysis page needs for a single fixture. */
export interface AnalysisBundle {
  fixture: Fixture;
  homeStats: TeamStats;
  awayStats: TeamStats;
  h2h: HeadToHead;
  prediction: BttsPrediction;
  generatedAt: string;
}

// ---- Martingale staking system ----

export type BetResult = 'pending' | 'won' | 'lost';

/** A single bet tracked under the Martingale staking system. */
export interface Bet {
  id: string;
  createdAt: number;
  settledAt?: number;
  fixtureId?: string;
  matchLabel: string;
  market: string; // e.g. "BTTS"
  selection: string; // e.g. "SIM" / "NÃO"
  odds: number;
  stake: number; // computed at creation time
  step: number; // martingale step at creation time
  result: BetResult;
}

export interface MartingaleSettings {
  bankroll: number; // live balance
  baseProfit: number; // target profit per winning bet
  currentLoss: number; // accumulated loss in the active series
  martingaleStep: number; // current progression level (1 = fresh series)
}

export interface MartingaleStats {
  bankroll: number;
  totalStaked: number;
  totalProfit: number;
  roi: number; // percentage
  wins: number;
  losses: number;
  pending: number;
  winrate: number; // percentage over settled bets
  maxLossStreak: number;
  maxStake: number;
  /** Equity curve (cumulative profit) over settled bets, oldest → newest. */
  equity: Array<{ index: number; profit: number; label: string }>;
}

/** A row in the dashboard table. `prediction` may be pending (still loading)
 * or absent (computation failed, e.g. API rate limit) — the fixture is shown
 * regardless so the user always sees the games. */
export interface DashboardRow {
  fixture: Fixture;
  prediction?: BttsPrediction;
  predictionError?: boolean;
}
