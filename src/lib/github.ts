import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type {
  GitHubCommit,
  GitHubIssue,
  GitHubPR,
  GitHubDayActivity,
  GitHubCache,
} from "./types";

const execFileAsync = promisify(execFile);
const CACHE_PATH = path.join(process.cwd(), "data", "github-cache.json");
const USERNAME = "jacksonspindle";
const CACHE_VERSION = 1;
const TODAY_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

async function loadCache(): Promise<GitHubCache> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf-8");
    const cache = JSON.parse(raw) as GitHubCache;
    if (cache.version === CACHE_VERSION) return cache;
  } catch {
    // no cache or invalid
  }
  return { version: CACHE_VERSION, username: USERNAME, days: {} };
}

async function saveCache(cache: GitHubCache): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function isToday(date: string): boolean {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return date === today;
}

async function ghApi(endpoint: string): Promise<unknown> {
  try {
    const { stdout } = await execFileAsync("gh", ["api", endpoint, "--paginate"], {
      timeout: 15000,
    });
    return JSON.parse(stdout);
  } catch (err) {
    console.error(`gh api ${endpoint} failed:`, err);
    return null;
  }
}

async function fetchCommits(date: string): Promise<GitHubCommit[]> {
  const q = encodeURIComponent(`author:${USERNAME} author-date:${date}`);
  const data = (await ghApi(
    `/search/commits?q=${q}&per_page=100`
  )) as { items?: Array<{ sha: string; commit: { message: string; author: { date: string } }; html_url: string; repository: { full_name: string } }> } | null;

  if (!data?.items) return [];
  return data.items.map((item) => ({
    repo: item.repository.full_name,
    sha: item.sha.slice(0, 7),
    message: item.commit.message.split("\n")[0],
    url: item.html_url,
    timestamp: item.commit.author.date,
  }));
}

async function fetchIssuesCreated(date: string): Promise<GitHubIssue[]> {
  const q = encodeURIComponent(
    `author:${USERNAME} created:${date} type:issue`
  );
  const data = (await ghApi(
    `/search/issues?q=${q}&per_page=100`
  )) as { items?: Array<{ number: number; title: string; html_url: string; state: string; repository_url: string }> } | null;

  if (!data?.items) return [];
  return data.items.map((item) => ({
    repo: item.repository_url.replace("https://api.github.com/repos/", ""),
    number: item.number,
    title: item.title,
    url: item.html_url,
    state: item.state,
    action: "created" as const,
  }));
}

async function fetchIssuesCommented(date: string): Promise<GitHubIssue[]> {
  const q = encodeURIComponent(
    `commenter:${USERNAME} updated:${date} type:issue`
  );
  const data = (await ghApi(
    `/search/issues?q=${q}&per_page=100`
  )) as { items?: Array<{ number: number; title: string; html_url: string; state: string; repository_url: string }> } | null;

  if (!data?.items) return [];
  return data.items.map((item) => ({
    repo: item.repository_url.replace("https://api.github.com/repos/", ""),
    number: item.number,
    title: item.title,
    url: item.html_url,
    state: item.state,
    action: "commented" as const,
  }));
}

async function fetchPRs(date: string): Promise<GitHubPR[]> {
  const q = encodeURIComponent(
    `author:${USERNAME} created:${date} type:pr`
  );
  const data = (await ghApi(
    `/search/issues?q=${q}&per_page=100`
  )) as { items?: Array<{ number: number; title: string; html_url: string; state: string; repository_url: string; pull_request?: { merged_at?: string } }> } | null;

  if (!data?.items) return [];
  return data.items.map((item) => ({
    repo: item.repository_url.replace("https://api.github.com/repos/", ""),
    number: item.number,
    title: item.title,
    url: item.html_url,
    state: item.state,
    action: item.pull_request?.merged_at ? ("merged" as const) : ("opened" as const),
  }));
}

export async function getGitHubActivity(
  date: string
): Promise<GitHubDayActivity | null> {
  const cache = await loadCache();

  // Check cache — past days are permanent, today expires after 2 hours
  const cached = cache.days[date];
  if (cached) {
    if (!isToday(date)) return cached;
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < TODAY_CACHE_TTL_MS) return cached;
  }

  try {
    const [commits, issuesCreated, issuesCommented, pullRequests] =
      await Promise.all([
        fetchCommits(date),
        fetchIssuesCreated(date),
        fetchIssuesCommented(date),
        fetchPRs(date),
      ]);

    // Merge issues — deduplicate by number+repo, prefer "created" over "commented"
    const issueMap = new Map<string, GitHubIssue>();
    for (const issue of [...issuesCreated, ...issuesCommented]) {
      const key = `${issue.repo}#${issue.number}`;
      const existing = issueMap.get(key);
      if (!existing || issue.action === "created") {
        issueMap.set(key, issue);
      }
    }

    const activity: GitHubDayActivity = {
      date,
      commits,
      issues: Array.from(issueMap.values()),
      pullRequests,
      fetchedAt: new Date().toISOString(),
    };

    cache.days[date] = activity;
    await saveCache(cache);

    return activity;
  } catch (err) {
    console.error("GitHub fetch failed:", err);
    return cached ?? null;
  }
}
