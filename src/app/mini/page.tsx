"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { useUsageData } from "@/hooks/use-usage-data";
import { useGitHubStats } from "@/hooks/use-github-stats";
import { Maximize2, Zap, GitCommitHorizontal, Flame, Loader2, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import type { DayDetailResponse } from "@/lib/types";
import { computeScoreSummary, type DailyScoreInput } from "@/lib/productivity-score";
import type { CombinedDailyData } from "@/lib/github-types";

function getLocalHour(timestamp: string | number): number {
  return new Date(typeof timestamp === "number" ? timestamp : timestamp).getHours();
}

function getLocalDate(timestamp: string | number): string {
  return new Date(typeof timestamp === "number" ? timestamp : timestamp).toLocaleDateString("en-CA");
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function formatDateLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "Today";
  if (dateStr === offsetDate(todayStr, -1)) return "Yesterday";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MiniPlayer() {
  const { data: usageData } = useUsageData();
  const { data: githubData } = useGitHubStats();
  const [dayDetail, setDayDetail] = useState<DayDetailResponse | null>(null);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  const todayStr = new Date().toLocaleDateString("en-CA");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const fetchDayDetail = useCallback(() => {
    setDayDetail(null);
    fetch(`/api/day-detail?date=${selectedDate}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDayDetail(d))
      .catch(() => {});
  }, [selectedDate]);

  useEffect(() => {
    fetchDayDetail();
    // Only auto-refresh for today
    if (selectedDate === todayStr) {
      const id = setInterval(fetchDayDetail, 30 * 1000);
      return () => clearInterval(id);
    }
  }, [fetchDayDetail, selectedDate, todayStr]);

  const dayUsage = useMemo(() => {
    if (!dayDetail) return { tokens: 0, sessions: 0 };
    return { tokens: dayDetail.totalTokens, sessions: dayDetail.totalSessions };
  }, [dayDetail]);

  const dayGitHub = useMemo(() => {
    if (!dayDetail?.github) return { commits: 0 };
    const count = dayDetail.github.commits.filter((c) => getLocalDate(c.timestamp) === selectedDate).length;
    return { commits: count };
  }, [dayDetail, selectedDate]);

  const streak = githubData?.streaks.currentCombined.days ?? 0;

  const dayScore = useMemo(() => {
    if (!usageData || !githubData || !dayDetail) return null;
    const map = new Map<string, CombinedDailyData>();
    for (const d of usageData.daily) {
      map.set(d.date, { date: d.date, tokens: d.tokens, commits: 0, prsOpened: 0, prsMerged: 0, issuesCreated: 0 });
    }
    for (const d of githubData.daily) {
      const existing = map.get(d.date);
      if (existing) {
        existing.commits = d.commits;
        existing.prsOpened = d.prsOpened;
        existing.prsMerged = d.prsMerged;
        existing.issuesCreated = d.issuesCreated;
      } else {
        map.set(d.date, { date: d.date, tokens: 0, commits: d.commits, prsOpened: d.prsOpened, prsMerged: d.prsMerged, issuesCreated: d.issuesCreated });
      }
    }
    const combinedDaily = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    const usageLookup = new Map<string, { sessions: number; toolCalls: number }>();
    for (const d of usageData.daily) {
      usageLookup.set(d.date, { sessions: d.sessions, toolCalls: d.toolCalls });
    }
    const inputs: DailyScoreInput[] = combinedDaily.map((d) => {
      const usage = usageLookup.get(d.date);
      return { date: d.date, commits: d.commits, prsMerged: d.prsMerged, prsOpened: d.prsOpened, issuesCreated: d.issuesCreated, tokens: d.tokens, sessions: usage?.sessions ?? 0, toolCalls: usage?.toolCalls ?? 0 };
    });
    const summary = computeScoreSummary(inputs, streak);
    // Find the score for the selected date
    const dayEntry = summary.daily.find((d) => d.date === selectedDate);
    return dayEntry?.score ?? 0;
  }, [usageData, githubData, dayDetail, streak, selectedDate]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      activity: 0,
      tokens: 0,
      commits: 0,
    }));
    if (dayDetail?.hourlyTokens) {
      for (const [hourStr, tokens] of Object.entries(dayDetail.hourlyTokens)) {
        const h = Number(hourStr);
        if (h >= 0 && h < 24 && tokens > 0) {
          hours[h].tokens += tokens;
        }
      }
    }
    if (dayDetail?.github?.commits) {
      for (const c of dayDetail.github.commits) {
        if (getLocalDate(c.timestamp) !== selectedDate) continue;
        const h = getLocalHour(c.timestamp);
        hours[h].commits += 1;
      }
    }
    for (const h of hours) {
      h.activity = Math.round(h.tokens / 10000) + h.commits;
    }
    return hours;
  }, [dayDetail, selectedDate]);

  const currentHour = new Date().getHours();

  const handleExpand = () => {
    setExiting(true);
    setTimeout(() => {
      (
        window as unknown as {
          __TAURI_INTERNALS__: { invoke: (cmd: string) => void };
        }
      ).__TAURI_INTERNALS__.invoke("exit_mini_mode");
    }, 200);
  };

  const goBack = () => setSelectedDate((d) => offsetDate(d, -1));
  const goForward = () => {
    if (!isToday) setSelectedDate((d) => offsetDate(d, 1));
  };

  const stats = [
    { label: "Score", value: dayScore ?? 0, icon: TrendingUp, color: "text-cyan-400", loading: dayScore === null },
    { label: "Tokens", value: formatTokens(dayUsage.tokens), icon: Zap, color: "text-green-400", loading: !dayDetail },
    { label: "Commits", value: dayGitHub.commits, icon: GitCommitHorizontal, color: "text-purple-400", loading: !dayDetail },
    { label: "Streak", value: streak, icon: Flame, color: "text-amber-400", loading: false },
  ];

  return (
    <div
      className="h-screen w-screen select-none overflow-hidden bg-background transition-all duration-200 ease-out"
      style={{
        opacity: mounted && !exiting ? 1 : 0,
        transform: mounted && !exiting ? "scale(1)" : "scale(0.95)",
      }}
    >
      {/* Traffic light row with expand button */}
      <div data-tauri-drag-region className="flex items-center justify-end px-3 pt-1.5 h-8">
        <button
          onClick={handleExpand}
          className="rounded-md p-1 text-gray-500 hover:bg-white/[0.08] hover:text-gray-200 transition-all"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Title with day navigation */}
      <div data-tauri-drag-region className="flex items-center justify-between px-3 pb-1">
        <button
          onClick={goBack}
          className="rounded-md p-0.5 text-gray-500 hover:bg-white/[0.08] hover:text-gray-200 transition-all"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span
          className="text-[11px] font-medium text-gray-400 cursor-pointer hover:text-gray-200 transition-colors"
          onClick={() => setSelectedDate(todayStr)}
        >
          {formatDateLabel(selectedDate, todayStr)} &mdash; {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
        <button
          onClick={goForward}
          disabled={isToday}
          className="rounded-md p-0.5 text-gray-500 hover:bg-white/[0.08] hover:text-gray-200 transition-all disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-500"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between px-3 pt-1.5">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center flex-1">
            <div className="flex items-center gap-1">
              <s.icon className={`h-3 w-3 ${s.color}`} />
              <span className="text-sm font-bold tracking-tight text-white leading-none">
                {s.loading ? <Loader2 className="h-3 w-3 animate-spin text-gray-500" /> : s.value}
              </span>
            </div>
            <span className="text-[9px] text-gray-500 mt-0.5">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Hourly activity chart */}
      <div className="px-3 pt-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 pt-1.5 pb-1">
          <span className="text-[10px] text-gray-500 px-1">Activity by hour</span>
          <div className="h-[56px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="miniBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: number) => (h % 6 === 0 ? `${h}` : "")}
                  tick={{ fontSize: 8, fill: "rgba(255,255,255,0.25)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    if (d.tokens === 0 && d.commits === 0) return null;
                    const hour = d.hour;
                    const label = `${hour % 12 || 12}${hour < 12 ? "am" : "pm"}–${(hour + 1) % 12 || 12}${hour + 1 < 12 || hour + 1 === 24 ? "am" : "pm"}`;
                    return (
                      <div className="rounded-lg border border-white/10 bg-gray-900/95 px-2.5 py-1.5 text-[10px] shadow-lg backdrop-blur">
                        <div className="font-medium text-gray-300 mb-0.5">{label}</div>
                        {d.tokens > 0 && <div className="text-green-400">{formatTokens(d.tokens)} tokens</div>}
                        {d.commits > 0 && <div className="text-purple-400">{d.commits} commit{d.commits !== 1 ? "s" : ""}</div>}
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="activity"
                  fill="url(#miniBarGrad)"
                  radius={[2, 2, 0, 0]}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const isCurrent = isToday && payload.hour === currentHour;
                    const isEmpty = payload.activity === 0;
                    return (
                      <rect
                        x={x}
                        y={isEmpty ? y + height - 2 : y}
                        width={width}
                        height={isEmpty ? 2 : height}
                        rx={2}
                        fill={isCurrent ? "#4ade80" : isEmpty ? "rgba(255,255,255,0.06)" : "url(#miniBarGrad)"}
                        opacity={isCurrent && isEmpty ? 0.4 : 1}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
