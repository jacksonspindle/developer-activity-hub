export interface GitHubDailyAggregate {
  date: string;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  prsReviewed: number;
  issuesCreated: number;
}

export interface RepoStats {
  name: string;
  commits: number;
  prs: number;
  issues: number;
  language: string;
  languageColor: string;
  lastActivity: string;
}

export interface StreakInfo {
  days: number;
  start: string;
  end: string;
}

export interface StreakData {
  current: StreakInfo;
  longest: StreakInfo;
  currentCombined: StreakInfo;
  longestCombined: StreakInfo;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
  progress?: { current: number; target: number };
}

export interface GitHubBulkStats {
  fetchedAt: string;
  username: string;
  dateRange: { start: string; end: string };
  daily: GitHubDailyAggregate[];
  totals: {
    commits: number;
    prsOpened: number;
    prsMerged: number;
    prsReviewed: number;
    issuesCreated: number;
  };
  repos: RepoStats[];
  streaks: StreakData;
  achievements: Achievement[];
}

export interface CombinedDailyData {
  date: string;
  tokens: number;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  issuesCreated: number;
}
