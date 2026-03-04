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
const TODAY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

function isMergeCommit(message: string): boolean {
  return /^Merge (pull request|branch) /.test(message);
}

async function fetchCommits(date: string): Promise<GitHubCommit[]> {
  let commits: GitHubCommit[];

  if (isToday(date)) {
    // For today, prefer repo-level API as primary (no search indexing delay)
    commits = await fetchTodayCommitsFromRepos(date);
    // Supplement with search API for repos we might have missed
    const searchCommits = await fetchCommitsFromSearch(date);
    const existingShas = new Set(commits.map((c) => c.sha));
    for (const c of searchCommits) {
      if (!existingShas.has(c.sha)) {
        commits.push(c);
      }
    }
  } else {
    commits = await fetchCommitsFromSearch(date);
  }

  // Filter out merge commits — they're not real work
  return commits.filter((c) => !isMergeCommit(c.message));
}

async function fetchCommitsFromSearch(date: string): Promise<GitHubCommit[]> {
  const q = encodeURIComponent(`author:${USERNAME} author-date:${date}`);
  const data = (await ghApi(
    `/search/commits?q=${q}&per_page=100`
  )) as { items?: Array<{ sha: string; commit: { message: string; author: { date: string } }; html_url: string; repository: { full_name: string } }> } | null;

  return (data?.items ?? []).map((item) => ({
    repo: item.repository.full_name,
    sha: item.sha,
    message: item.commit.message.split("\n")[0],
    url: item.html_url,
    timestamp: item.commit.author.date,
  }));
}

async function fetchTodayCommitsFromRepos(date: string): Promise<GitHubCommit[]> {
  const sinceISO = new Date(date + "T00:00:00").toISOString();
  let repos: Array<{ full_name: string; pushed_at: string }> = [];
  try {
    const result = await ghApi(`/user/repos?type=owner&sort=pushed&direction=desc&per_page=20`);
    const allRepos = result as Array<{ full_name: string; pushed_at: string }>;
    if (Array.isArray(allRepos)) {
      repos = allRepos.filter((r) => r.pushed_at >= sinceISO);
    }
  } catch {
    return [];
  }

  const commits: GitHubCommit[] = [];
  await Promise.all(
    repos.map(async (repo) => {
      try {
        const result = await ghApi(
          `/repos/${repo.full_name}/commits?author=${USERNAME}&since=${sinceISO}&per_page=100`
        );
        const items = result as Array<{
          sha: string;
          commit: { message: string; author: { date: string } };
          html_url: string;
          author: { login: string } | null;
        }> | null;
        if (Array.isArray(items)) {
          for (const c of items) {
            if (c.author?.login === USERNAME) {
              commits.push({
                repo: repo.full_name,
                sha: c.sha,
                message: c.commit.message.split("\n")[0],
                url: c.html_url,
                timestamp: c.commit.author.date,
              });
            }
          }
        }
      } catch {
        // skip repo
      }
    })
  );
  return commits;
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
