export interface CardConfig {
  id: string;
  defaultSpan: number;
  minSpan: number;
  maxSpan: number;
  label: string;
}

export const CARD_CONFIGS: CardConfig[] = [
  { id: "hero-tokens", defaultSpan: 2, minSpan: 1, maxSpan: 4, label: "Total Tokens" },
  { id: "hero-commits", defaultSpan: 2, minSpan: 1, maxSpan: 4, label: "Total Commits" },
  { id: "stat-sessions", defaultSpan: 1, minSpan: 1, maxSpan: 2, label: "Sessions" },
  { id: "stat-repos", defaultSpan: 1, minSpan: 1, maxSpan: 2, label: "Repos" },
  { id: "stat-prs", defaultSpan: 1, minSpan: 1, maxSpan: 2, label: "PRs Merged" },
  { id: "stat-streak", defaultSpan: 1, minSpan: 1, maxSpan: 2, label: "Streak" },
  { id: "productivity-score", defaultSpan: 2, minSpan: 2, maxSpan: 4, label: "Productivity Score" },
  { id: "combined-timeline", defaultSpan: 3, minSpan: 2, maxSpan: 4, label: "Combined Activity" },
  { id: "recent-projects", defaultSpan: 1, minSpan: 1, maxSpan: 4, label: "Recent Projects" },
  { id: "year-heatmap", defaultSpan: 4, minSpan: 2, maxSpan: 4, label: "Year Heatmap" },
  { id: "streaks", defaultSpan: 2, minSpan: 1, maxSpan: 4, label: "Streaks & Achievements" },
  { id: "repos", defaultSpan: 2, minSpan: 1, maxSpan: 4, label: "Repository Breakdown" },
  { id: "pr-issues", defaultSpan: 2, minSpan: 1, maxSpan: 4, label: "PR & Issue Stats" },
  { id: "models", defaultSpan: 2, minSpan: 1, maxSpan: 4, label: "Model Breakdown" },
  { id: "activity-heatmap", defaultSpan: 2, minSpan: 1, maxSpan: 4, label: "Activity by Hour" },
];

export const DEFAULT_CARD_ORDER = CARD_CONFIGS.map((c) => c.id);

export const DEFAULT_CARD_SPANS: Record<string, number> = Object.fromEntries(
  CARD_CONFIGS.map((c) => [c.id, c.defaultSpan])
);
