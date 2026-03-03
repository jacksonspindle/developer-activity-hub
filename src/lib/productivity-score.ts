// Productivity Score — pure computation, no React

export const SCORE_WEIGHTS = {
  commits: 40,
  prsMerged: 5,
  prsOpened: 5,
  issuesCreated: 5,
  tokens: 20,
  sessions: 15,
  toolCalls: 10,
} as const;

// Minimum floors — adaptive thresholds can never drop below these
export const MIN_THRESHOLDS = {
  commits: 2,
  prsMerged: 1,
  prsOpened: 1,
  issuesCreated: 1,
  tokens: 50_000,
  sessions: 2,
  toolCalls: 15,
} as const;

// Fallback thresholds used when there isn't enough history
export const DEFAULT_THRESHOLDS = {
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

export type AdaptiveThresholds = Record<ScoreMetric, number>;

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
  deltaVsPrevWeek: number;
  thresholds: AdaptiveThresholds;
}

// Compute the 75th percentile of non-zero values from the last 30 days
function percentile75(values: number[]): number {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return 0;
  const idx = Math.ceil(nonZero.length * 0.75) - 1;
  return nonZero[idx];
}

export function computeAdaptiveThresholds(
  inputs: DailyScoreInput[]
): AdaptiveThresholds {
  // Use last 30 days of data
  const recent = inputs.slice(-30);

  const metrics: ScoreMetric[] = [
    "commits", "prsMerged", "prsOpened", "issuesCreated",
    "tokens", "sessions", "toolCalls",
  ];

  const thresholds = {} as AdaptiveThresholds;

  for (const metric of metrics) {
    const values = recent.map((d) => d[metric]);
    const p75 = percentile75(values);

    if (p75 > 0) {
      // Use 75th percentile, but never below the minimum floor
      thresholds[metric] = Math.max(p75, MIN_THRESHOLDS[metric]);
    } else {
      // No data for this metric — fall back to default
      thresholds[metric] = DEFAULT_THRESHOLDS[metric];
    }
  }

  return thresholds;
}

function computeBaseScore(
  input: DailyScoreInput,
  thresholds: AdaptiveThresholds
): {
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

  const metrics: ScoreMetric[] = [
    "commits", "prsMerged", "prsOpened", "issuesCreated",
    "tokens", "sessions", "toolCalls",
  ];

  const breakdown = {} as ScoreBreakdown;
  for (const m of metrics) {
    breakdown[m] = Math.min(input[m] / thresholds[m], 1.5) * SCORE_WEIGHTS[m];
  }

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
  const thresholds = computeAdaptiveThresholds(inputs);
  const streakBonus = Math.min(streakDays / 14, 1) * 0.1;

  const dailyScores: DailyScore[] = [];
  const rawScores: number[] = [];

  for (const input of inputs) {
    const { score: base, breakdown, rawValues } = computeBaseScore(input, thresholds);
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

  let deltaVsPrevWeek = 0;
  if (len >= 8) {
    const prevWeekAvg = dailyScores[len - 8].avg7d;
    if (prevWeekAvg > 0) {
      deltaVsPrevWeek = Math.round(((avg7d - prevWeekAvg) / prevWeekAvg) * 100);
    }
  }

  return { daily: dailyScores, current, avg7d, avg30d, deltaVsPrevWeek, thresholds };
}
