import type { ScoreBreakdown } from "./productivity-score";

export interface WeekIdentifier {
  week: string; // "2026-W09"
  start: string; // "2026-02-23" (Monday)
  end: string; // "2026-03-01" (Sunday)
  label: string; // "Feb 23 – Mar 1, 2026"
}

export interface WeeklyScoreDay {
  date: string;
  score: number;
  avg7d: number;
  breakdown: ScoreBreakdown;
  rawValues: ScoreBreakdown;
}

export interface TopProductiveDay {
  date: string;
  score: number;
  highlight: string;
}

export interface WeeklyProjectStats {
  project: string;
  totalTokens: number;
  totalDurationMs: number;
  sessionCount: number;
  filesModified: string[];
}

export interface WeeklyPRItem {
  repo: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
}

export interface WeeklyCostBreakdown {
  model: string;
  displayName: string;
  color: string;
  tokens: number;
  costUSD: number;
}

export interface WeeklyMetricDelta {
  label: string;
  current: number;
  previous: number;
  deltaPct: number;
  unit: string;
}

export interface WeeklyDigestResponse {
  week: WeekIdentifier;
  scores: WeeklyScoreDay[];
  topDays: TopProductiveDay[];
  projects: WeeklyProjectStats[];
  prsMerged: WeeklyPRItem[];
  hotspotFiles: Array<{ file: string; count: number }>;
  cost: WeeklyCostBreakdown[];
  totalCostUSD: number;
  deltas: WeeklyMetricDelta[];
  aiSummary: string | null;
  activeDates: string[];
}
