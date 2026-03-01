"use client";

import { useState, useMemo } from "react";
import { BentoCard } from "@/components/bento-card";
import { RepoExplorerModal } from "@/components/repo-explorer-modal";
import type { RepoStats } from "@/lib/github-types";

interface RecentProjectsProps {
  repos: RepoStats[];
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function RecentProjects({ repos }: RecentProjectsProps) {
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  const sortedRepos = useMemo(
    () =>
      [...repos].sort(
        (a, b) => b.lastActivity.localeCompare(a.lastActivity)
      ),
    [repos]
  );

  return (
    <>
      <BentoCard>
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Recent Projects</h3>
          <p className="text-xs text-gray-500">
            Click a repo to explore commits &amp; files
          </p>
        </div>
        <div className="space-y-1.5">
          {sortedRepos.map((repo) => {
            const repoName = repo.name.includes("/")
              ? repo.name.split("/")[1]
              : repo.name;

            return (
              <button
                key={repo.name}
                onClick={() => setSelectedRepo(repo.name)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left group"
              >
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: repo.languageColor }}
                />
                <span className="text-sm font-medium text-gray-200 truncate flex-1 group-hover:text-white transition-colors">
                  {repoName}
                </span>
                <span
                  className="text-[10px] rounded-full px-1.5 py-0.5 border border-white/[0.08] bg-white/[0.03] shrink-0"
                  style={{ color: repo.languageColor }}
                >
                  {repo.language}
                </span>
                <div className="flex gap-1.5 text-[10px] text-muted-foreground shrink-0">
                  <span className="text-blue-400">{repo.commits}c</span>
                  <span className="text-purple-400">{repo.prs}pr</span>
                  <span className="text-orange-400">{repo.issues}i</span>
                </div>
                <span className="text-[10px] text-gray-600 shrink-0 w-14 text-right">
                  {formatRelativeTime(repo.lastActivity)}
                </span>
              </button>
            );
          })}
          {sortedRepos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent projects
            </p>
          )}
        </div>
      </BentoCard>

      <RepoExplorerModal
        repo={selectedRepo}
        onClose={() => setSelectedRepo(null)}
      />
    </>
  );
}
