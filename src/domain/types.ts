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

/** A row in the dashboard table. */
export interface DashboardRow {
  fixture: Fixture;
  prediction: BttsPrediction;
}
