"use client";

import { useState, useMemo } from "react";
import { useUsageData } from "@/hooks/use-usage-data";
import { useGitHubStats } from "@/hooks/use-github-stats";
import { HeroStats } from "@/components/hero-stats";
import { StatCard } from "@/components/stat-card";
import { CombinedTimeline } from "@/components/combined-timeline";
import { YearHeatmap } from "@/components/year-heatmap";
import { StreakAchievements } from "@/components/streak-achievements";
import { RepoBreakdown } from "@/components/repo-breakdown";
import { PRIssueStats } from "@/components/pr-issue-stats";
import { ModelBreakdown } from "@/components/model-breakdown";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { DayDetailModal } from "@/components/day-detail-modal";
import { Skeleton } from "@/components/ui/skeleton";
import type { CombinedDailyData } from "@/lib/github-types";
import {
  MonitorSmartphone,
  GitFork,
  GitPullRequest,
  Flame,
} from "lucide-react";

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Skeleton className="col-span-1 md:col-span-2 h-36 rounded-2xl" />
      <Skeleton className="col-span-1 md:col-span-2 h-36 rounded-2xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-2xl" />
      ))}
      <Skeleton className="col-span-2 lg:col-span-4 h-[400px] rounded-2xl" />
      <Skeleton className="col-span-2 h-[200px] rounded-2xl" />
      <Skeleton className="col-span-2 h-[200px] rounded-2xl" />
      <Skeleton className="col-span-2 h-[300px] rounded-2xl" />
      <Skeleton className="col-span-2 h-[300px] rounded-2xl" />
    </div>
  );
}

export default function Home() {
  const { data: usageData, loading: usageLoading, error: usageError } = useUsageData();
  const { data: githubData, loading: githubLoading } = useGitHubStats();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const combinedDaily = useMemo<CombinedDailyData[]>(() => {
    const map = new Map<string, CombinedDailyData>();

    if (usageData) {
      for (const d of usageData.daily) {
        map.set(d.date, {
          date: d.date,
          tokens: d.tokens,
          commits: 0,
          prsOpened: 0,
          prsMerged: 0,
          issuesCreated: 0,
        });
      }
    }

    if (githubData) {
      for (const d of githubData.daily) {
        const existing = map.get(d.date);
        if (existing) {
          existing.commits = d.commits;
          existing.prsOpened = d.prsOpened;
          existing.prsMerged = d.prsMerged;
          existing.issuesCreated = d.issuesCreated;
        } else {
          map.set(d.date, {
            date: d.date,
            tokens: 0,
            commits: d.commits,
            prsOpened: d.prsOpened,
            prsMerged: d.prsMerged,
            issuesCreated: d.issuesCreated,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [usageData, githubData]);

  const claudeHeatmapData = useMemo(() => {
    const map = new Map<string, number>();
    if (usageData) {
      for (const d of usageData.daily) {
        if (d.tokens > 0) {
          map.set(d.date, d.sessions + Math.ceil(d.tokens / 100000));
        }
      }
    }
    return map;
  }, [usageData]);

  const githubHeatmapData = useMemo(() => {
    const map = new Map<string, number>();
    if (githubData) {
      for (const d of githubData.daily) {
        const total = d.commits + d.prsOpened + d.prsMerged + d.issuesCreated;
        if (total > 0) map.set(d.date, total);
      }
    }
    return map;
  }, [githubData]);

  const loading = usageLoading;

  return (
    <div className="min-h-screen bg-[#060a12]">
      {/* Multi-layer background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(74,222,128,0.04)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_50%,rgba(96,165,250,0.02)_0%,transparent_60%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center rounded-full border border-green-500/20 bg-green-500/[0.06] px-3 py-1 mb-3">
            <span className="text-xs text-green-400 font-mono tracking-wider">@jacksonspindle</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Developer Activity Hub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Claude Code + GitHub — all in one place
          </p>
        </div>

        {usageError && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/[0.06] backdrop-blur-2xl p-4 text-center text-red-400">
            {usageError}
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {usageData && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/* Row 1: Hero stats */}
            <HeroStats
              totalTokens={usageData.totalTokens}
              totalCommits={githubData?.totals.commits ?? 0}
            />

            {/* Row 2: Quick stats */}
            <StatCard
              label="Sessions"
              value={usageData.totalSessions}
              icon={MonitorSmartphone}
              color="green"
              info="Total Claude Code sessions"
            />
            <StatCard
              label="Repos"
              value={githubData?.repos.length ?? 0}
              icon={GitFork}
              color="blue"
              info="Active repositories in the last 90 days"
            />
            <StatCard
              label="PRs Merged"
              value={githubData?.totals.prsMerged ?? 0}
              icon={GitPullRequest}
              color="purple"
              info="Pull requests merged in the last 90 days"
            />
            <StatCard
              label="Streak"
              value={githubData?.streaks.currentCombined.days ?? 0}
              icon={Flame}
              color="amber"
              info="Current consecutive days with Claude or GitHub activity"
            />

            {/* Row 3: Combined timeline */}
            <CombinedTimeline
              data={combinedDaily}
              onDayClick={setSelectedDate}
            />

            {/* Row 4: Year heatmaps */}
            <YearHeatmap
              title="Claude Activity"
              subtitle="Token usage this year"
              data={claudeHeatmapData}
              color="green"
              onDayClick={setSelectedDate}
            />
            {githubData ? (
              <YearHeatmap
                title="GitHub Activity"
                subtitle="Commits, PRs & issues this year"
                data={githubHeatmapData}
                color="blue"
                onDayClick={setSelectedDate}
              />
            ) : (
              <div className="col-span-1 md:col-span-2 rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30">
                {githubLoading ? (
                  <Skeleton className="h-[180px] rounded-xl" />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">GitHub data unavailable</p>
                  </div>
                )}
              </div>
            )}

            {/* Row 5: Streaks + Repos */}
            {githubData ? (
              <StreakAchievements
                streaks={githubData.streaks}
                achievements={githubData.achievements}
              />
            ) : (
              <div className="col-span-1 md:col-span-2 rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30">
                {githubLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    GitHub data unavailable
                  </p>
                )}
              </div>
            )}
            {githubData ? (
              <RepoBreakdown repos={githubData.repos} />
            ) : (
              <div className="col-span-1 md:col-span-2 rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30">
                {githubLoading ? (
                  <Skeleton className="h-[250px] rounded-xl" />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No repository data</p>
                  </div>
                )}
              </div>
            )}

            {/* Row 6: PR/Issue stats + Model breakdown */}
            {githubData ? (
              <PRIssueStats
                prsOpened={githubData.totals.prsOpened}
                prsMerged={githubData.totals.prsMerged}
                prsReviewed={githubData.totals.prsReviewed}
                issuesCreated={githubData.totals.issuesCreated}
              />
            ) : (
              <div className="col-span-1 md:col-span-2 rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30">
                {githubLoading ? (
                  <Skeleton className="h-[250px] rounded-xl" />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No PR/issue data</p>
                  </div>
                )}
              </div>
            )}
            <ModelBreakdown modelUsage={usageData.modelUsage} />

            {/* Row 7: Activity by hour */}
            <ActivityHeatmap hourCounts={usageData.hourCounts} />
          </div>
        )}

        <DayDetailModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      </div>
    </div>
  );
}
