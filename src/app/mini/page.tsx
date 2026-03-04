"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { useUsageData } from "@/hooks/use-usage-data";
import { useGitHubStats } from "@/hooks/use-github-stats";
import { Maximize2, Zap, MonitorSmartphone, GitCommitHorizontal, Flame, Loader2 } from "lucide-react";
import type { DayDetailResponse } from "@/lib/types";

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

export default function MiniPlayer() {
  const { data: usageData } = useUsageData();
  const { data: githubData } = useGitHubStats();
  const [dayDetail, setDayDetail] = useState<DayDetailResponse | null>(null);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const todayStr = new Date().toLocaleDateString("en-CA");

  const fetchDayDetail = useCallback(() => {
    fetch(`/api/day-detail?date=${todayStr}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDayDetail(d))
      .catch(() => {});
  }, [todayStr]);

  useEffect(() => {
    fetchDayDetail();
    const id = setInterval(fetchDayDetail, 30 * 1000);
    return () => clearInterval(id);
  }, [fetchDayDetail]);

  const todayUsage = useMemo(() => {
    if (!dayDetail) return { tokens: 0, sessions: 0 };
    return { tokens: dayDetail.totalTokens, sessions: dayDetail.totalSessions };
  }, [dayDetail]);

  const todayGitHub = useMemo(() => {
    if (!dayDetail?.github) return { commits: 0 };
    const count = dayDetail.github.commits.filter((c) => getLocalDate(c.timestamp) === todayStr).length;
    return { commits: count };
  }, [dayDetail, todayStr]);

  const streak = githubData?.streaks.currentCombined.days ?? 0;

  // Derive hourly activity from today's sessions + commits
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      activity: 0,
      sessions: 0,
      tokens: 0,
      commits: 0,
    }));
    if (dayDetail?.sessions) {
      for (const s of dayDetail.sessions) {
        if (getLocalDate(s.timestamp) !== todayStr) continue;
        const h = getLocalHour(s.timestamp);
        hours[h].activity += 1;
        hours[h].sessions += 1;
        hours[h].tokens += s.totalTokens;
      }
    }
    if (dayDetail?.github?.commits) {
      for (const c of dayDetail.github.commits) {
        if (getLocalDate(c.timestamp) !== todayStr) continue;
        const h = getLocalHour(c.timestamp);
        hours[h].activity += 1;
        hours[h].commits += 1;
      }
    }
    return hours;
  }, [dayDetail]);

  const currentHour = new Date().getHours();

  const dateLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

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

  const stats = [
    { label: "Tokens", value: formatTokens(todayUsage.tokens), icon: Zap, color: "text-green-400" },
    { label: "Sessions", value: todayUsage.sessions, icon: MonitorSmartphone, color: "text-blue-400" },
    { label: "Commits", value: todayGitHub.commits, icon: GitCommitHorizontal, color: "text-purple-400" },
    { label: "Streak", value: streak, icon: Flame, color: "text-amber-400" },
  ];

  return (
    <div
      className="h-screen w-screen select-none overflow-hidden bg-background transition-all duration-200 ease-out"
      style={{
        opacity: mounted && !exiting ? 1 : 0,
        transform: mounted && !exiting ? "scale(1)" : "scale(0.95)",
      }}
    >
      {/* Draggable title bar */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-4 pt-8 pb-1"
      >
        <span className="text-[11px] font-medium text-gray-400 pointer-events-none">
          Today &mdash; {dateLabel}
        </span>
        <div className="h-1 w-8 rounded-full bg-white/10" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-1.5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5"
          >
            <s.icon className={`h-3.5 w-3.5 mb-0.5 ${s.color}`} />
            <span className="text-base font-bold tracking-tight text-white leading-none flex items-center justify-center">
              {!dayDetail && s.label !== "Streak" ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : s.value}
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Hourly activity chart */}
      <div className="px-3 pt-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 pt-1.5 pb-1">
          <span className="text-[10px] text-gray-500 px-1">Today&apos;s activity by hour</span>
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
                    if (d.sessions === 0 && d.commits === 0) return null;
                    const hour = d.hour;
                    const label = `${hour % 12 || 12}${hour < 12 ? "am" : "pm"}–${(hour + 1) % 12 || 12}${hour + 1 < 12 || hour + 1 === 24 ? "am" : "pm"}`;
                    return (
                      <div className="rounded-lg border border-white/10 bg-gray-900/95 px-2.5 py-1.5 text-[10px] shadow-lg backdrop-blur">
                        <div className="font-medium text-gray-300 mb-0.5">{label}</div>
                        {d.sessions > 0 && <div className="text-blue-400">{d.sessions} session{d.sessions !== 1 ? "s" : ""} · {formatTokens(d.tokens)} tokens</div>}
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
                    const isCurrent = payload.hour === currentHour;
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

      {/* Expand button */}
      <div className="flex justify-center pt-2 pb-1.5">
        <button
          onClick={handleExpand}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-[11px] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 transition-all"
        >
          <Maximize2 className="h-3 w-3" />
          Expand
        </button>
      </div>
    </div>
  );
}
