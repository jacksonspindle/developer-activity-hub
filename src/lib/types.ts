export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface ModelUsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
  maxOutputTokens: number;
}

export interface StatsCache {
  version: number;
  lastComputedDate: string;
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, ModelUsageStats>;
  totalSessions: number;
  totalMessages: number;
  longestSession: {
    sessionId: string;
    duration: number;
    messageCount: number;
    timestamp: string;
  };
  firstSessionDate: string;
  hourCounts: Record<string, number>;
  totalSpeculationTimeSavedMs: number;
}

export interface DailyUsage {
  date: string;
  tokens: number;
  messages: number;
  sessions: number;
  toolCalls: number;
  tokensByModel: Record<string, number>;
}

export interface UsageData {
  daily: DailyUsage[];
  totalTokens: number;
  totalMessages: number;
  totalSessions: number;
  totalToolCalls: number;
  daysActive: number;
  modelUsage: Record<string, ModelUsageStats>;
  hourCounts: Record<string, number>;
  firstSessionDate: string;
}

export interface ArchivedSession {
  sessionId: string;
  date: string;
  project: string;
  projectPath: string;
  taskDescription: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  toolCalls: string[];
  toolCallCount: number;
  model: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  durationMs: number;
  filesModified: string[];
  timestamp: number;
}

export interface SessionArchive {
  version: number;
  lastScanAt: string;
  sessions: ArchivedSession[];
  daySummaries?: Record<string, string>;
}

export interface DayDetailResponse {
  date: string;
  totalTokens: number;
  totalSessions: number;
  totalMessages: number;
  totalToolCalls: number;
  sessions: ArchivedSession[];
  hasSessionData: boolean;
  daySummary?: string;
  github?: GitHubDayActivity;
}

// GitHub integration types

export interface GitHubCommit {
  repo: string;
  sha: string;
  message: string;
  url: string;
  timestamp: string;
}

export interface GitHubIssue {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: string;
  action: "created" | "commented";
}

export interface GitHubPR {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: string;
  action: "opened" | "merged" | "reviewed";
}

export interface GitHubDayActivity {
  date: string;
  commits: GitHubCommit[];
  issues: GitHubIssue[];
  pullRequests: GitHubPR[];
  fetchedAt: string;
}

export interface GitHubCache {
  version: number;
  username: string;
  days: Record<string, GitHubDayActivity>;
}
