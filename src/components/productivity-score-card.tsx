"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { BentoCard } from "@/components/bento-card";
import { formatDate, formatFullDate, cn } from "@/lib/utils";
import type { ScoreSummary, DailyScore } from "@/lib/productivity-score";
import { SCORE_WEIGHTS } from "@/lib/productivity-score";

interface ProductivityScoreCardProps {
  summary: ScoreSummary;
}

type AvgMode = "7d" | "30d";

function scoreColor(score: number): string {
  if (score >= 70) return "#4ade80"; // green
  if (score >= 40) return "#fbbf24"; // amber
  return "#f87171"; // red
}

function scoreColorClass(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

const FACTOR_LABELS: Record<string, string> = {
  commits: "Commits",
  prsMerged: "PRs Merged",
  prsOpened: "PRs Opened",
  issuesCreated: "Issues",
  tokens: "Tokens",
  sessions: "Sessions",
  toolCalls: "Tool Calls",
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: DailyScore }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const entry = payload[0];
  const daily = entry.payload;

  return (
    <div
      className="rounded-xl border border-white/[0.12] bg-[#0c1220]/95 backdrop-blur-2xl px-3 py-2.5 shadow-2xl shadow-black/60 min-w-[180px]"
      style={{ zIndex: 99999 }}
    >
      <p className="text-xs text-gray-400 mb-1.5">{formatFullDate(label)}</p>
      <p className="text-lg font-bold mb-2" style={{ color: scoreColor(daily.score) }}>
        {Math.round(daily.score)}
      </p>
      <div className="space-y-1">
        {(Object.keys(daily.breakdown) as Array<keyof typeof daily.breakdown>).map(
          (key) => {
            const value = daily.breakdown[key];
            const max = SCORE_WEIGHTS[key];
            const pct = max > 0 ? (value / max) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-2 text-[11px]">
                <span className="text-gray-500 w-[72px] shrink-0">
                  {FACTOR_LABELS[key]}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-400/80"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-gray-400 w-[36px] text-right tabular-nums">
                  {Math.round(value)}/{max}
                </span>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

export function ProductivityScoreCard({ summary }: ProductivityScoreCardProps) {
  const [avgMode, setAvgMode] = useState<AvgMode>("7d");

  const chartData = summary.daily.map((d) => ({
    ...d,
    displayAvg: avgMode === "7d" ? d.avg7d : d.avg30d,
  }));

  const currentAvg = avgMode === "7d" ? summary.avg7d : summary.avg30d;
  const delta = summary.deltaVsPrevWeek;

  return (
    <BentoCard variant="accent-purple">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Productivity Score</h3>
          <p className="text-xs text-gray-500">Composite daily score (0–100)</p>
        </div>

        {/* Toggle pills */}
        <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          {(["7d", "30d"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setAvgMode(mode)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                avgMode === mode
                  ? "bg-white/[0.1] text-white"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              {mode === "7d" ? "7-Day Avg" : "30-Day Avg"}
            </button>
          ))}
        </div>
      </div>

      {/* Hero row */}
      <div className="flex items-end gap-4 mb-4">
        <span
          className={cn("text-4xl font-bold tabular-nums leading-none", scoreColorClass(summary.current))}
        >
          {Math.round(summary.current)}
        </span>

        {delta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
              delta > 0
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            )}
          >
            {delta > 0 ? "↑" : "↓"}{Math.abs(delta)}% vs last week
          </span>
        )}

        <div className="ml-auto flex gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">7d avg</p>
            <p className={cn("text-sm font-semibold tabular-nums", scoreColorClass(summary.avg7d))}>
              {Math.round(summary.avg7d)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">30d avg</p>
            <p className={cn("text-sm font-semibold tabular-nums", scoreColorClass(summary.avg30d))}>
              {Math.round(summary.avg30d)}
            </p>
          </div>
        </div>
      </div>

      {/* Area chart */}
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#a855f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="rgba(255,255,255,0.15)"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="rgba(255,255,255,0.15)"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            />
            <ReferenceLine
              y={70}
              stroke="rgba(74,222,128,0.2)"
              strokeDasharray="4 4"
              label={{
                value: "70",
                position: "right",
                fill: "rgba(74,222,128,0.35)",
                fontSize: 10,
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="displayAvg"
              stroke="#a855f6"
              strokeWidth={2}
              fill="url(#scoreGradient)"
              dot={false}
              activeDot={{
                r: 5,
                fill: "#a855f6",
                stroke: "#c084fc",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </BentoCard>
  );
}
