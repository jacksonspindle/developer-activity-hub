"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useUsageData } from "@/hooks/use-usage-data";
import { useGitHubStats } from "@/hooks/use-github-stats";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { HeroStatsCard } from "@/components/hero-stats";
import { StatCard } from "@/components/stat-card";
import { CombinedTimeline } from "@/components/combined-timeline";
import { UnifiedYearHeatmap } from "@/components/unified-year-heatmap";
import { StreakAchievements } from "@/components/streak-achievements";
import { RepoBreakdown } from "@/components/repo-breakdown";
import { RecentProjects } from "@/components/recent-projects";
import { PRIssueStats } from "@/components/pr-issue-stats";
import { ModelBreakdown } from "@/components/model-breakdown";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { ProductivityScoreCard } from "@/components/productivity-score-card";
import { computeScoreSummary, type DailyScoreInput } from "@/lib/productivity-score";
import { DayDetailModal } from "@/components/day-detail-modal";
import { DashboardGrid } from "@/components/dashboard-grid";
import { Skeleton } from "@/components/ui/skeleton";
import type { CombinedDailyData } from "@/lib/github-types";
import {
  MonitorSmartphone,
  GitFork,
  GitPullRequest,
  Flame,
  RefreshCw,
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
  const { data: usageData, loading: usageLoading, error: usageError, refresh: refreshUsage } = useUsageData();
  const { data: githubData, loading: githubLoading, refresh: refreshGitHub } = useGitHubStats();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const {
    cardOrder,
    cardSpans,
    reorderCards,
    setCardSpan,
  } = useDashboardLayout();

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshUsage();
    refreshGitHub();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshUsage, refreshGitHub]);

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

  const scoreSummary = useMemo(() => {
    const usageLookup = new Map<string, { sessions: number; toolCalls: number }>();
    if (usageData) {
      for (const d of usageData.daily) {
        usageLookup.set(d.date, { sessions: d.sessions, toolCalls: d.toolCalls });
      }
    }

    const inputs: DailyScoreInput[] = combinedDaily.map((d) => {
      const usage = usageLookup.get(d.date);
      return {
        date: d.date,
        commits: d.commits,
        prsMerged: d.prsMerged,
        prsOpened: d.prsOpened,
        issuesCreated: d.issuesCreated,
        tokens: d.tokens,
        sessions: usage?.sessions ?? 0,
        toolCalls: usage?.toolCalls ?? 0,
      };
    });

    const streakDays = githubData?.streaks.currentCombined.days ?? 0;
    return computeScoreSummary(inputs, streakDays);
  }, [combinedDaily, usageData, githubData]);

  const loading = usageLoading;

  const renderCard = useCallback(
    (cardId: string): React.ReactNode => {
      switch (cardId) {
        case "hero-stats":
          return (
            <HeroStatsCard
              totalTokens={usageData?.totalTokens ?? 0}
              totalCommits={githubData?.totals.commits ?? 0}
            />
          );
        case "stat-sessions":
          return (
            <StatCard
              label="Sessions"
              value={usageData?.totalSessions ?? 0}
              icon={MonitorSmartphone}
              color="green"
              info="Total Claude Code sessions"
            />
          );
        case "stat-repos":
          return (
            <StatCard
              label="Repos"
              value={githubData?.repos.length ?? 0}
              icon={GitFork}
              color="blue"
              info="Active repositories in the last 90 days"
            />
          );
        case "stat-prs":
          return (
            <StatCard
              label="PRs Merged"
              value={githubData?.totals.prsMerged ?? 0}
              icon={GitPullRequest}
              color="purple"
              info="Pull requests merged in the last 90 days"
            />
          );
        case "stat-streak":
          return (
            <StatCard
              label="Streak"
              value={githubData?.streaks.currentCombined.days ?? 0}
              icon={Flame}
              color="amber"
              info="Current consecutive days with Claude or GitHub activity"
            />
          );
        case "productivity-score":
          return <ProductivityScoreCard summary={scoreSummary} />;
        case "combined-timeline":
          return (
            <CombinedTimeline
              data={combinedDaily}
              onDayClick={setSelectedDate}
            />
          );
        case "year-heatmap":
          return (
            <UnifiedYearHeatmap
              claudeData={claudeHeatmapData}
              githubData={githubHeatmapData}
              onDayClick={setSelectedDate}
            />
          );
        case "streaks":
          if (!githubData) {
            return githubLoading ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30">
                <div className="space-y-3">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-32 rounded-xl" />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30">
                <p className="text-sm text-muted-foreground text-center py-8">
                  GitHub data unavailable
                </p>
              </div>
            );
          }
          return (
            <StreakAchievements
              streaks={githubData.streaks}
              achievements={githubData.achievements}
            />
          );
        case "repos":
          if (!githubData) {
            return githubLoading ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30">
                <Skeleton className="h-[250px] rounded-xl" />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30 text-center py-8">
                <p className="text-sm text-muted-foreground">No repository data</p>
              </div>
            );
          }
          return <RepoBreakdown repos={githubData.repos} />;
        case "recent-projects":
          if (!githubData) {
            return githubLoading ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30">
                <Skeleton className="h-[250px] rounded-xl" />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30 text-center py-8">
                <p className="text-sm text-muted-foreground">No project data</p>
              </div>
            );
          }
          return <RecentProjects repos={githubData.repos} />;
        case "pr-issues":
          if (!githubData) {
            return githubLoading ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30">
                <Skeleton className="h-[250px] rounded-xl" />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-3xl p-5 shadow-xl shadow-black/30 text-center py-8">
                <p className="text-sm text-muted-foreground">No PR/issue data</p>
              </div>
            );
          }
          return (
            <PRIssueStats
              prsOpened={githubData.totals.prsOpened}
              prsMerged={githubData.totals.prsMerged}
              prsReviewed={githubData.totals.prsReviewed}
              issuesCreated={githubData.totals.issuesCreated}
              items={githubData.items}
            />
          );
        case "models":
          return <ModelBreakdown modelUsage={usageData?.modelUsage ?? {}} />;
        case "activity-heatmap":
          return <ActivityHeatmap hourCounts={usageData?.hourCounts ?? {}} />;
        default:
          return null;
      }
    },
    [usageData, githubData, githubLoading, combinedDaily, claudeHeatmapData, githubHeatmapData, scoreSummary, setSelectedDate]
  );

  return (
    <div className="min-h-screen bg-[#060a12]">
      {/* Multi-layer background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(74,222,128,0.04)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_50%,rgba(96,165,250,0.02)_0%,transparent_60%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-center"
        >
          <div className="inline-flex items-center rounded-full border border-green-500/20 bg-green-500/[0.06] px-3 py-1 mb-3">
            <span className="text-xs text-green-400 font-mono tracking-wider">@jacksonspindle</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Developer Activity Hub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Claude Code + GitHub — all in one place
          </p>

          {/* Refresh control */}
          {usageData && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          )}
        </motion.div>

        {usageError && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/[0.06] backdrop-blur-2xl p-4 text-center text-red-400">
            {usageError}
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {usageData && (
          <DashboardGrid
            cardOrder={cardOrder}
            cardSpans={cardSpans}
            onReorder={reorderCards}
            onSpanChange={setCardSpan}
            renderCard={renderCard}
          />
        )}

        <DayDetailModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      </div>
    </div>
  );
}
