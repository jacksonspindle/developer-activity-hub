import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import type {
  RepoMetadata,
  RepoCommit,
  TreeEntry,
  RepoDetailResponse,
} from "@/lib/repo-detail-types";

const execFileAsync = promisify(execFile);

async function ghApi(endpoint: string): Promise<unknown> {
  const { stdout } = await execFileAsync("gh", ["api", endpoint], {
    timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get("repo");
  const treePath = request.nextUrl.searchParams.get("path") || "";

  if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
    return NextResponse.json(
      { error: "Missing or invalid repo parameter (expected owner/repo)" },
      { status: 400 }
    );
  }

  try {
    const contentsPath = treePath
      ? `/repos/${repo}/contents/${treePath}`
      : `/repos/${repo}/contents`;

    const [repoData, commitsData, contentsData] = await Promise.all([
      ghApi(`/repos/${repo}`) as Promise<Record<string, unknown>>,
      ghApi(`/repos/${repo}/commits?per_page=10`) as Promise<
        Record<string, unknown>[]
      >,
      ghApi(contentsPath).catch(() => []) as Promise<
        Record<string, unknown>[] | Record<string, unknown>
      >,
    ]);

    const metadata: RepoMetadata = {
      fullName: repoData.full_name as string,
      description: (repoData.description as string) || null,
      stars: repoData.stargazers_count as number,
      forks: repoData.forks_count as number,
      language: (repoData.language as string) || null,
      htmlUrl: repoData.html_url as string,
      defaultBranch: repoData.default_branch as string,
      topics: (repoData.topics as string[]) || [],
    };

    const commits: RepoCommit[] = (commitsData || []).map((c) => {
      const commit = c.commit as Record<string, unknown>;
      const author = commit.author as Record<string, unknown>;
      return {
        sha: (c.sha as string).slice(0, 7),
        message: ((commit.message as string) || "").split("\n")[0],
        authorName: (author.name as string) || "Unknown",
        date: author.date as string,
        htmlUrl: c.html_url as string,
      };
    });

    const rawTree = Array.isArray(contentsData) ? contentsData : [];
    const tree: TreeEntry[] = rawTree
      .map((entry) => ({
        name: entry.name as string,
        path: entry.path as string,
        type: (entry.type === "dir" ? "dir" : "file") as "dir" | "file",
        size: (entry.size as number) || 0,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const response: RepoDetailResponse = {
      metadata,
      commits,
      tree,
      currentPath: treePath,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load repo detail",
      },
      { status: 500 }
    );
  }
}
