"use client";

import { BentoCard } from "@/components/bento-card";
import type { RepoStats } from "@/lib/github-types";

interface RepoBreakdownProps {
  repos: RepoStats[];
}

export function RepoBreakdown({ repos }: RepoBreakdownProps) {
  const topRepos = repos.slice(0, 8);
  const maxActivity = Math.max(
    ...topRepos.map((r) => r.commits + r.prs + r.issues),
    1
  );

  return (
    <BentoCard>
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Repository Breakdown</h3>
        <p className="text-xs text-gray-500">Top repos by activity (90 days)</p>
      </div>
      <div className="space-y-3">
        {topRepos.map((repo) => {
          const total = repo.commits + repo.prs + repo.issues;
          const widthPct = (total / maxActivity) * 100;
          const repoName = repo.name.includes("/")
            ? repo.name.split("/")[1]
            : repo.name;

          return (
            <div key={repo.name}>
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: repo.languageColor }}
                />
                <span className="text-sm font-medium truncate flex-1">
                  {repoName}
                </span>
                <span
                  className="text-[10px] rounded-full px-1.5 py-0.5 border border-white/[0.08] bg-white/[0.03]"
                  style={{ color: repo.languageColor }}
                >
                  {repo.language}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${widthPct}%`,
                      background: `linear-gradient(90deg, ${repo.languageColor}80, ${repo.languageColor}40)`,
                    }}
                  />
                </div>
                <div className="flex gap-2 text-[10px] text-muted-foreground flex-shrink-0">
                  <span className="text-blue-400">{repo.commits}c</span>
                  <span className="text-purple-400">{repo.prs}pr</span>
                  <span className="text-orange-400">{repo.issues}i</span>
                </div>
              </div>
            </div>
          );
        })}
        {topRepos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No repository data available
          </p>
        )}
      </div>
    </BentoCard>
  );
}
