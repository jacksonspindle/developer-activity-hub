import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type {
  GitHubDailyAggregate,
  RepoStats,
  GitHubBulkStats,
} from "./github-types";
import { calculateStreaks, computeAchievements } from "./achievements";
import { loadUsageData } from "./parse-stats";

const execFileAsync = promisify(execFile);
const CACHE_PATH = path.join(process.cwd(), "data", "github-bulk-stats.json");
const USERNAME = "jacksonspindle";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Dart: "#00B4AB",
  PHP: "#4F5D95",
  Vue: "#41b883",
  Svelte: "#ff3e00",
};

async function ghSearchApi(
  endpoint: string,
  page = 1
): Promise<{ total_count: number; items: unknown[] } | null> {
  try {
    const separator = endpoint.includes("?") ? "&" : "?";
    const url = `${endpoint}${separator}per_page=100&page=${page}`;
    const { stdout } = await execFileAsync("gh", ["api", url], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (err) {
    console.error(`gh search api failed: ${endpoint}`, err);
    return null;
  }
}

async function fetchAllPages(endpoint: string): Promise<unknown[]> {
  const allItems: unknown[] = [];
  let page = 1;
  while (true) {
    const result = await ghSearchApi(endpoint, page);
    if (!result?.items?.length) break;
    allItems.push(...result.items);
    if (allItems.length >= result.total_count || result.items.length < 100) break;
    page++;
  }
  return allItems;
}

function formatDateRange(daysAgo: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysAgo);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

function dateToLocal(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-CA");
}

interface CommitItem {
  sha: string;
  commit: { message: string; author: { date: string } };
  html_url: string;
  repository: { full_name: string };
}

interface IssueItem {
  number: number;
  title: string;
  html_url: string;
  state: string;
  repository_url: string;
  created_at: string;
  pull_request?: { merged_at?: string };
}

async function fetchCommits90Days(): Promise<CommitItem[]> {
  const allCommits: CommitItem[] = [];
  // Split into 3x30-day windows to avoid search API limits
  for (let i = 0; i < 3; i++) {
    const end = new Date();
    end.setDate(end.getDate() - i * 30);
    const start = new Date();
    start.setDate(start.getDate() - (i + 1) * 30);
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];
    const q = encodeURIComponent(
      `author:${USERNAME} author-date:${startStr}..${endStr}`
    );
    const items = await fetchAllPages(`/search/commits?q=${q}`);
    allCommits.push(...(items as CommitItem[]));
  }
  return allCommits;
}

async function fetchPRsOpened90Days(): Promise<IssueItem[]> {
  const { start, end } = formatDateRange(90);
  const q = encodeURIComponent(
    `author:${USERNAME} type:pr created:${start}..${end}`
  );
  return (await fetchAllPages(`/search/issues?q=${q}`)) as IssueItem[];
}

async function fetchPRsReviewed90Days(): Promise<IssueItem[]> {
  const { start, end } = formatDateRange(90);
  const q = encodeURIComponent(
    `reviewed-by:${USERNAME} type:pr created:${start}..${end}`
  );
  return (await fetchAllPages(`/search/issues?q=${q}`)) as IssueItem[];
}

async function fetchIssuesCreated90Days(): Promise<IssueItem[]> {
  const { start, end } = formatDateRange(90);
  const q = encodeURIComponent(
    `author:${USERNAME} type:issue created:${start}..${end}`
  );
  return (await fetchAllPages(`/search/issues?q=${q}`)) as IssueItem[];
}

async function fetchRepoLanguage(
  repoFullName: string
): Promise<{ language: string; color: string }> {
  try {
    const { stdout } = await execFileAsync(
      "gh",
      ["api", `/repos/${repoFullName}/languages`],
      { timeout: 10000 }
    );
    const languages = JSON.parse(stdout) as Record<string, number>;
    const topLang = Object.entries(languages).sort((a, b) => b[1] - a[1])[0];
    if (topLang) {
      return {
        language: topLang[0],
        color: LANGUAGE_COLORS[topLang[0]] || "#94a3b8",
      };
    }
  } catch {
    // ignore
  }
  return { language: "Unknown", color: "#94a3b8" };
}

function aggregateDaily(
  commits: CommitItem[],
  prsOpened: IssueItem[],
  prsReviewed: IssueItem[],
  issuesCreated: IssueItem[],
  prsMergedSet: Set<string>
): GitHubDailyAggregate[] {
  const dayMap = new Map<string, GitHubDailyAggregate>();

  function getDay(date: string): GitHubDailyAggregate {
    let day = dayMap.get(date);
    if (!day) {
      day = { date, commits: 0, prsOpened: 0, prsMerged: 0, prsReviewed: 0, issuesCreated: 0 };
      dayMap.set(date, day);
    }
    return day;
  }

  for (const c of commits) {
    const date = dateToLocal(c.commit.author.date);
    getDay(date).commits++;
  }
  for (const pr of prsOpened) {
    const date = dateToLocal(pr.created_at);
    getDay(date).prsOpened++;
    if (prsMergedSet.has(pr.html_url)) {
      getDay(date).prsMerged++;
    }
  }
  for (const pr of prsReviewed) {
    const date = dateToLocal(pr.created_at);
    getDay(date).prsReviewed++;
  }
  for (const issue of issuesCreated) {
    const date = dateToLocal(issue.created_at);
    getDay(date).issuesCreated++;
  }

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildRepoStats(
  commits: CommitItem[],
  prsOpened: IssueItem[],
  issuesCreated: IssueItem[]
): Map<string, { commits: number; prs: number; issues: number; lastActivity: string }> {
  const repoMap = new Map<
    string,
    { commits: number; prs: number; issues: number; lastActivity: string }
  >();

  function getRepo(name: string) {
    let repo = repoMap.get(name);
    if (!repo) {
      repo = { commits: 0, prs: 0, issues: 0, lastActivity: "" };
      repoMap.set(name, repo);
    }
    return repo;
  }

  for (const c of commits) {
    const repo = getRepo(c.repository.full_name);
    repo.commits++;
    const date = dateToLocal(c.commit.author.date);
    if (date > repo.lastActivity) repo.lastActivity = date;
  }
  for (const pr of prsOpened) {
    const name = pr.repository_url.replace("https://api.github.com/repos/", "");
    const repo = getRepo(name);
    repo.prs++;
    const date = dateToLocal(pr.created_at);
    if (date > repo.lastActivity) repo.lastActivity = date;
  }
  for (const issue of issuesCreated) {
    const name = issue.repository_url.replace("https://api.github.com/repos/", "");
    const repo = getRepo(name);
    repo.issues++;
    const date = dateToLocal(issue.created_at);
    if (date > repo.lastActivity) repo.lastActivity = date;
  }

  return repoMap;
}

async function loadCache(): Promise<GitHubBulkStats | null> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf-8");
    const cached = JSON.parse(raw) as GitHubBulkStats;
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) return cached;
  } catch {
    // no cache
  }
  return null;
}

async function saveCache(stats: GitHubBulkStats): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(stats, null, 2));
}

export async function loadGitHubBulkStats(): Promise<GitHubBulkStats> {
  const cached = await loadCache();
  if (cached) return cached;

  // Fetch all data in parallel
  const [commits, prsOpened, prsReviewed, issuesCreated] = await Promise.all([
    fetchCommits90Days(),
    fetchPRsOpened90Days(),
    fetchPRsReviewed90Days(),
    fetchIssuesCreated90Days(),
  ]);

  // Determine merged PRs
  const prsMergedSet = new Set<string>();
  for (const pr of prsOpened) {
    if (pr.pull_request?.merged_at) {
      prsMergedSet.add(pr.html_url);
    }
  }

  const daily = aggregateDaily(commits, prsOpened, prsReviewed, issuesCreated, prsMergedSet);

  // Build repo stats with language info for top 10
  const repoMap = buildRepoStats(commits, prsOpened, issuesCreated);
  const topRepoNames = Array.from(repoMap.entries())
    .sort((a, b) => {
      const aTotal = a[1].commits + a[1].prs + a[1].issues;
      const bTotal = b[1].commits + b[1].prs + b[1].issues;
      return bTotal - aTotal;
    })
    .slice(0, 10);

  const repoLanguages = await Promise.all(
    topRepoNames.map(([name]) => fetchRepoLanguage(name))
  );

  const repos: RepoStats[] = topRepoNames.map(([name, stats], i) => ({
    name,
    commits: stats.commits,
    prs: stats.prs,
    issues: stats.issues,
    language: repoLanguages[i].language,
    languageColor: repoLanguages[i].color,
    lastActivity: stats.lastActivity,
  }));

  const totals = {
    commits: commits.length,
    prsOpened: prsOpened.length,
    prsMerged: prsMergedSet.size,
    prsReviewed: prsReviewed.length,
    issuesCreated: issuesCreated.length,
  };

  // Load Claude data for combined streaks
  let claudeDaily: { date: string; tokens: number }[] = [];
  try {
    const usageData = await loadUsageData();
    claudeDaily = usageData.daily.map((d) => ({ date: d.date, tokens: d.tokens }));
  } catch {
    // Claude data not available
  }

  const today = new Date().toLocaleDateString("en-CA");
  const streaks = calculateStreaks(claudeDaily, daily, today);
  const achievements = computeAchievements(totals, streaks, claudeDaily, daily);

  const { start, end } = formatDateRange(90);
  const stats: GitHubBulkStats = {
    fetchedAt: new Date().toISOString(),
    username: USERNAME,
    dateRange: { start, end },
    daily,
    totals,
    repos,
    streaks,
    achievements,
  };

  await saveCache(stats);
  return stats;
}
