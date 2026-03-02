// Productivity Score — pure computation, no React

export const SCORE_WEIGHTS = {
  commits: 30,
  prsMerged: 5,
  prsOpened: 5,
  issuesCreated: 5,
  tokens: 25,
  sessions: 20,
  toolCalls: 10,
} as const;

export const SCORE_THRESHOLDS = {
  commits: 5,
  prsMerged: 1,
  prsOpened: 2,
  issuesCreated: 2,
  tokens: 100_000,
  sessions: 3,
  toolCalls: 30,
} as const;

export type ScoreMetric = keyof typeof SCORE_WEIGHTS;

export interface DailyScoreInput {
  date: string;
  commits: number;
  prsMerged: number;
  prsOpened: number;
  issuesCreated: number;
  tokens: number;
  sessions: number;
  toolCalls: number;
}

export interface ScoreBreakdown {
  commits: number;
  prsMerged: number;
  prsOpened: number;
  issuesCreated: number;
  tokens: number;
  sessions: number;
  toolCalls: number;
}

export interface DailyScore {
  date: string;
  score: number;
  breakdown: ScoreBreakdown;
  rawValues: ScoreBreakdown;
  avg7d: number;
  avg30d: number;
}

export interface ScoreSummary {
  daily: DailyScore[];
  current: number;
  avg7d: number;
  avg30d: number;
  deltaVsPrevWeek: number; // percentage change
}

function computeBaseScore(input: DailyScoreInput): {
  score: number;
  breakdown: ScoreBreakdown;
  rawValues: ScoreBreakdown;
} {
  const rawValues: ScoreBreakdown = {
    commits: input.commits,
    prsMerged: input.prsMerged,
    prsOpened: input.prsOpened,
    issuesCreated: input.issuesCreated,
    tokens: input.tokens,
    sessions: input.sessions,
    toolCalls: input.toolCalls,
  };

  const breakdown: ScoreBreakdown = {
    commits: Math.min(input.commits / SCORE_THRESHOLDS.commits, 1) * SCORE_WEIGHTS.commits,
    prsMerged: Math.min(input.prsMerged / SCORE_THRESHOLDS.prsMerged, 1) * SCORE_WEIGHTS.prsMerged,
    prsOpened: Math.min(input.prsOpened / SCORE_THRESHOLDS.prsOpened, 1) * SCORE_WEIGHTS.prsOpened,
    issuesCreated: Math.min(input.issuesCreated / SCORE_THRESHOLDS.issuesCreated, 1) * SCORE_WEIGHTS.issuesCreated,
    tokens: Math.min(input.tokens / SCORE_THRESHOLDS.tokens, 1) * SCORE_WEIGHTS.tokens,
    sessions: Math.min(input.sessions / SCORE_THRESHOLDS.sessions, 1) * SCORE_WEIGHTS.sessions,
    toolCalls: Math.min(input.toolCalls / SCORE_THRESHOLDS.toolCalls, 1) * SCORE_WEIGHTS.toolCalls,
  };

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { score: Math.round(score * 10) / 10, breakdown, rawValues };
}

function rollingAvg(scores: number[], endIdx: number, window: number): number {
  const start = Math.max(0, endIdx - window + 1);
  const slice = scores.slice(start, endIdx + 1);
  if (slice.length === 0) return 0;
  return Math.round((slice.reduce((s, v) => s + v, 0) / slice.length) * 10) / 10;
}

export function computeScoreSummary(
  inputs: DailyScoreInput[],
  streakDays: number
): ScoreSummary {
  const streakBonus = Math.min(streakDays / 14, 1) * 0.1;

  const dailyScores: DailyScore[] = [];
  const rawScores: number[] = [];

  for (const input of inputs) {
    const { score: base, breakdown, rawValues } = computeBaseScore(input);
    const final = Math.min(Math.round(base * (1 + streakBonus) * 10) / 10, 100);
    rawScores.push(final);

    const idx = rawScores.length - 1;
    dailyScores.push({
      date: input.date,
      score: final,
      breakdown,
      rawValues,
      avg7d: rollingAvg(rawScores, idx, 7),
      avg30d: rollingAvg(rawScores, idx, 30),
    });
  }

  const len = dailyScores.length;
  const current = len > 0 ? dailyScores[len - 1].score : 0;
  const avg7d = len > 0 ? dailyScores[len - 1].avg7d : 0;
  const avg30d = len > 0 ? dailyScores[len - 1].avg30d : 0;

  // Delta vs previous week: compare last 7d avg to the 7d avg ending 7 days ago
  let deltaVsPrevWeek = 0;
  if (len >= 8) {
    const prevWeekAvg = dailyScores[len - 8].avg7d;
    if (prevWeekAvg > 0) {
      deltaVsPrevWeek = Math.round(((avg7d - prevWeekAvg) / prevWeekAvg) * 100);
    }
  }

  return { daily: dailyScores, current, avg7d, avg30d, deltaVsPrevWeek };
}
