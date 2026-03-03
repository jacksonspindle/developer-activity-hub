import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { loadUsageData } from "@/lib/parse-stats";
import { loadArchive } from "@/lib/archive";
import { loadGitHubBulkStats } from "@/lib/github-bulk";
import { computeScoreSummary, type DailyScoreInput } from "@/lib/productivity-score";
import { getModelDisplayName, getModelColor } from "@/lib/utils";
import { generateWeeklySummary } from "@/lib/ai-summary";
import { getWeekDates, buildWeekIdentifier, offsetWeek } from "@/lib/week-utils";
import type {
  WeeklyDigestResponse,
  WeeklyScoreDay,
  TopProductiveDay,
  WeeklyProjectStats,
  WeeklyPRItem,
  WeeklyCostBreakdown,
  WeeklyMetricDelta,
} from "@/lib/weekly-types";

const SUMMARIES_PATH = path.join(process.cwd(), "data", "weekly-summaries.json");

async function loadWeeklySummariesCache(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(SUMMARIES_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveWeeklySummary(week: string, summary: string): Promise<void> {
  const cache = await loadWeeklySummariesCache();
  cache[week] = summary;
  await fs.mkdir(path.dirname(SUMMARIES_PATH), { recursive: true });
  await fs.writeFile(SUMMARIES_PATH, JSON.stringify(cache, null, 2));
}

export async function GET(request: NextRequest) {
  const weekParam = request.nextUrl.searchParams.get("week");

  if (!weekParam || !/^\d{4}-W\d{2}$/.test(weekParam)) {
    return NextResponse.json(
      { error: "Missing or invalid week parameter (expected YYYY-Wnn)" },
      { status: 400 }
    );
  }

  try {
    const weekDates = getWeekDates(weekParam);
    const weekSet = new Set(weekDates);
    const weekId = buildWeekIdentifier(weekParam);

    // Load all data sources in parallel
    const [usageData, archive, githubData] = await Promise.all([
      loadUsageData(),
      loadArchive(),
      loadGitHubBulkStats().catch(() => null),
    ]);

    // --- Filter data to this week ---
    const weekUsage = usageData.daily.filter((d) => weekSet.has(d.date));
    const weekSessions = archive.sessions.filter((s) => weekSet.has(s.date));
    const weekGithubDaily = githubData?.daily.filter((d) => weekSet.has(d.date)) ?? [];

    // Active dates (any activity)
    const activeDates = new Set<string>();
    for (const d of weekUsage) {
      if (d.tokens > 0 || d.sessions > 0) activeDates.add(d.date);
    }
    for (const d of weekGithubDaily) {
      if (d.commits > 0 || d.prsOpened > 0 || d.prsMerged > 0) activeDates.add(d.date);
    }

    // --- 1. Scores ---
    // Build DailyScoreInput for ALL historical data (needed for adaptive thresholds)
    const usageLookup = new Map<string, { sessions: number; toolCalls: number; tokens: number }>();
    for (const d of usageData.daily) {
      usageLookup.set(d.date, { sessions: d.sessions, toolCalls: d.toolCalls, tokens: d.tokens });
    }

    const allDates = new Set<string>();
    for (const d of usageData.daily) allDates.add(d.date);
    if (githubData) {
      for (const d of githubData.daily) allDates.add(d.date);
    }

    const githubLookup = new Map<string, { commits: number; prsMerged: number; prsOpened: number; issuesCreated: number }>();
    if (githubData) {
      for (const d of githubData.daily) {
        githubLookup.set(d.date, { commits: d.commits, prsMerged: d.prsMerged, prsOpened: d.prsOpened, issuesCreated: d.issuesCreated });
      }
    }

    const allInputs: DailyScoreInput[] = Array.from(allDates)
      .sort()
      .map((date) => {
        const usage = usageLookup.get(date);
        const gh = githubLookup.get(date);
        return {
          date,
          commits: gh?.commits ?? 0,
          prsMerged: gh?.prsMerged ?? 0,
          prsOpened: gh?.prsOpened ?? 0,
          issuesCreated: gh?.issuesCreated ?? 0,
          tokens: usage?.tokens ?? 0,
          sessions: usage?.sessions ?? 0,
          toolCalls: usage?.toolCalls ?? 0,
        };
      });

    const streakDays = githubData?.streaks.currentCombined.days ?? 0;
    const allScores = computeScoreSummary(allInputs, streakDays);

    // Build a lookup of scores that exist for this week
    const scoreLookup = new Map(
      allScores.daily.filter((d) => weekSet.has(d.date)).map((d) => [d.date, d])
    );
    const emptyBreakdown = { commits: 0, prsMerged: 0, prsOpened: 0, issuesCreated: 0, tokens: 0, sessions: 0, toolCalls: 0 };

    // Ensure all 7 days are present (Mon–Sun), filling in zeros for missing days
    const weekScores: WeeklyScoreDay[] = weekDates.map((date) => {
      const existing = scoreLookup.get(date);
      if (existing) {
        return {
          date: existing.date,
          score: existing.score,
          avg7d: existing.avg7d,
          breakdown: existing.breakdown,
          rawValues: existing.rawValues,
        };
      }
      return { date, score: 0, avg7d: 0, breakdown: emptyBreakdown, rawValues: emptyBreakdown };
    });

    // --- 2. Top 3 days ---
    const factorLabels: Record<string, string> = {
      commits: "commits",
      prsMerged: "PRs merged",
      prsOpened: "PRs opened",
      issuesCreated: "issues created",
      tokens: "tokens used",
      sessions: "sessions",
      toolCalls: "tool calls",
    };

    const topDays: TopProductiveDay[] = [...weekScores]
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((d) => {
        // Find highest-weight breakdown factor
        const entries = Object.entries(d.breakdown) as Array<[string, number]>;
        const top = entries.sort((a, b) => b[1] - a[1])[0];
        const rawVal = d.rawValues[top[0] as keyof typeof d.rawValues];
        const highlight =
          top[0] === "tokens"
            ? `${Math.round(rawVal / 1000)}k ${factorLabels[top[0]]}`
            : `${rawVal} ${factorLabels[top[0]]}`;
        return { date: d.date, score: d.score, highlight };
      });

    // --- 3. Projects ---
    const projectMap = new Map<string, WeeklyProjectStats>();
    for (const session of weekSessions) {
      const existing = projectMap.get(session.project);
      if (existing) {
        existing.totalTokens += session.totalTokens;
        existing.totalDurationMs += session.durationMs;
        existing.sessionCount += 1;
        for (const f of session.filesModified) {
          if (!existing.filesModified.includes(f)) {
            existing.filesModified.push(f);
          }
        }
      } else {
        projectMap.set(session.project, {
          project: session.project,
          totalTokens: session.totalTokens,
          totalDurationMs: session.durationMs,
          sessionCount: 1,
          filesModified: [...session.filesModified],
        });
      }
    }
    const projects = Array.from(projectMap.values()).sort(
      (a, b) => b.totalTokens - a.totalTokens
    );

    // --- 4. PRs merged ---
    const prsMerged: WeeklyPRItem[] = [];
    if (githubData) {
      for (const pr of githubData.items.prsMerged) {
        const prDate = new Date(pr.createdAt).toLocaleDateString("en-CA");
        if (weekSet.has(prDate)) {
          prsMerged.push({
            repo: pr.repo,
            number: pr.number,
            title: pr.title,
            url: pr.url,
            createdAt: pr.createdAt,
          });
        }
      }
    }

    // --- 5. Hotspot files ---
    const fileCounts = new Map<string, number>();
    for (const session of weekSessions) {
      for (const file of session.filesModified) {
        fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
      }
    }
    const hotspotFiles = Array.from(fileCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, count]) => ({ file, count }));

    // --- 6. Cost breakdown ---
    // Approximate weekly cost: proportion of tokens used this week per model
    const weekTokensByModel = new Map<string, number>();
    for (const d of weekUsage) {
      for (const [model, tokens] of Object.entries(d.tokensByModel)) {
        weekTokensByModel.set(model, (weekTokensByModel.get(model) ?? 0) + tokens);
      }
    }

    let totalCostUSD = 0;
    const cost: WeeklyCostBreakdown[] = [];
    for (const [model, weekTokens] of weekTokensByModel.entries()) {
      const modelStats = usageData.modelUsage[model];
      if (!modelStats) continue;
      // Total tokens for this model across all time
      const totalModelTokens = modelStats.inputTokens + modelStats.outputTokens;
      const proportion = totalModelTokens > 0 ? weekTokens / totalModelTokens : 0;
      const modelCost = proportion * modelStats.costUSD;
      totalCostUSD += modelCost;
      cost.push({
        model,
        displayName: getModelDisplayName(model),
        color: getModelColor(model),
        tokens: weekTokens,
        costUSD: Math.round(modelCost * 100) / 100,
      });
    }
    cost.sort((a, b) => b.costUSD - a.costUSD);
    totalCostUSD = Math.round(totalCostUSD * 100) / 100;

    // --- 7. Deltas ---
    const prevWeek = offsetWeek(weekParam, -1);
    const prevDates = new Set(getWeekDates(prevWeek));

    const prevUsage = usageData.daily.filter((d) => prevDates.has(d.date));
    const prevGithub = githubData?.daily.filter((d) => prevDates.has(d.date)) ?? [];

    const currTokens = weekUsage.reduce((s, d) => s + d.tokens, 0);
    const prevTokens = prevUsage.reduce((s, d) => s + d.tokens, 0);
    const currSessions = weekUsage.reduce((s, d) => s + d.sessions, 0);
    const prevSessions = prevUsage.reduce((s, d) => s + d.sessions, 0);
    const currCommits = weekGithubDaily.reduce((s, d) => s + d.commits, 0);
    const prevCommits = prevGithub.reduce((s, d) => s + d.commits, 0);
    const currPRs = weekGithubDaily.reduce((s, d) => s + d.prsMerged, 0);
    const prevPRs = prevGithub.reduce((s, d) => s + d.prsMerged, 0);
    const currAvgScore = weekScores.length > 0
      ? weekScores.reduce((s, d) => s + d.score, 0) / weekScores.length
      : 0;
    const prevWeekScores = allScores.daily.filter((d) => prevDates.has(d.date));
    const prevAvgScore = prevWeekScores.length > 0
      ? prevWeekScores.reduce((s, d) => s + d.score, 0) / prevWeekScores.length
      : 0;

    function deltaPct(curr: number, prev: number): number {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    }

    const deltas: WeeklyMetricDelta[] = [
      { label: "Avg Score", current: Math.round(currAvgScore), previous: Math.round(prevAvgScore), deltaPct: deltaPct(currAvgScore, prevAvgScore), unit: "pts" },
      { label: "Tokens", current: currTokens, previous: prevTokens, deltaPct: deltaPct(currTokens, prevTokens), unit: "" },
      { label: "Sessions", current: currSessions, previous: prevSessions, deltaPct: deltaPct(currSessions, prevSessions), unit: "" },
      { label: "Commits", current: currCommits, previous: prevCommits, deltaPct: deltaPct(currCommits, prevCommits), unit: "" },
      { label: "PRs Merged", current: currPRs, previous: prevPRs, deltaPct: deltaPct(currPRs, prevPRs), unit: "" },
      { label: "Active Days", current: activeDates.size, previous: prevUsage.length + prevGithub.length > 0 ? new Set([...prevUsage.map((d) => d.date), ...prevGithub.map((d) => d.date)]).size : 0, deltaPct: deltaPct(activeDates.size, new Set([...prevUsage.map((d) => d.date), ...prevGithub.map((d) => d.date)]).size), unit: "days" },
    ];

    // --- 8. AI Summary ---
    let aiSummary: string | null = null;
    const summariesCache = await loadWeeklySummariesCache();
    if (summariesCache[weekParam]) {
      aiSummary = summariesCache[weekParam];
    } else if (activeDates.size > 0) {
      // Generate and cache in background
      const summaryPromise = generateWeeklySummary({
        weekLabel: weekId.label,
        avgScore: currAvgScore,
        totalTokens: currTokens,
        totalSessions: currSessions,
        totalCommits: currCommits,
        totalPRs: currPRs,
        topProjects: projects.slice(0, 5),
        topDays,
        totalCostUSD,
      });
      aiSummary = await summaryPromise;
      if (aiSummary) {
        saveWeeklySummary(weekParam, aiSummary).catch(() => {});
      }
    }

    const response: WeeklyDigestResponse = {
      week: weekId,
      scores: weekScores,
      topDays,
      projects,
      prsMerged,
      hotspotFiles,
      cost,
      totalCostUSD,
      deltas,
      aiSummary,
      activeDates: Array.from(activeDates).sort(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load weekly digest" },
      { status: 500 }
    );
  }
}
