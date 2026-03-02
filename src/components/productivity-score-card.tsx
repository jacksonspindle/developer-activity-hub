"use client";

import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";
import { BentoCard } from "@/components/bento-card";
import { InfoTooltip } from "@/components/info-tooltip";
import { formatDate, formatFullDate, cn } from "@/lib/utils";
import type { ScoreSummary, DailyScore, AdaptiveThresholds } from "@/lib/productivity-score";
import { SCORE_WEIGHTS } from "@/lib/productivity-score";

interface ProductivityScoreCardProps {
  summary: ScoreSummary;
  onDayClick?: (date: string) => void;
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

function formatRawValue(key: string, value: number): string {
  if (key === "tokens") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  }
  return String(value);
}

function formatThreshold(key: string, value: number): string {
  if (key === "tokens") return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function CustomTooltip({
  active,
  payload,
  label,
  thresholds,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: DailyScore }>;
  label?: string;
  thresholds?: AdaptiveThresholds;
}) {
  if (!active || !payload?.length || !label || !thresholds) return null;
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
            const raw = daily.rawValues[key];
            const threshold = thresholds[key];
            const pct = Math.min(raw / threshold, 1) * 100;
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
                <span className="text-gray-400 w-[46px] text-right tabular-nums">
                  {formatRawValue(key, raw)}/{formatThreshold(key, threshold)}
                </span>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

export function ProductivityScoreCard({ summary, onDayClick }: ProductivityScoreCardProps) {
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
          <h3 className="text-lg font-semibold">
            Productivity Score
            <InfoTooltip wide>
              <div className="space-y-2.5">
                <p className="text-gray-300 font-medium text-[11px]">
                  Daily score (0–100) based on your dev activity. Thresholds adapt to your 75th percentile over the last 30 days:
                </p>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left font-medium pb-1">Factor</th>
                      <th className="text-right font-medium pb-1">Weight</th>
                      <th className="text-right font-medium pb-1">Your 100%</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-400">
                    {(Object.keys(SCORE_WEIGHTS) as Array<keyof typeof SCORE_WEIGHTS>).map((key) => (
                      <tr key={key} className="border-t border-white/[0.04]">
                        <td className="py-0.5">{FACTOR_LABELS[key]}</td>
                        <td className="text-right tabular-nums">{SCORE_WEIGHTS[key]}pts</td>
                        <td className="text-right tabular-nums">
                          {formatThreshold(key, summary.thresholds[key])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-white/[0.06] pt-1.5 space-y-1 text-[10px] text-gray-500">
                  <p>Thresholds = 75th percentile of your non-zero days over the last 30 days, with a minimum floor so they never get too easy.</p>
                  <p>A streak bonus of up to +10% is applied based on consecutive active days (maxes at 14 days).</p>
                </div>
              </div>
            </InfoTooltip>
          </h3>
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#4ade80", opacity: 0.5 }} />
          <span>Great day (70–100)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#fbbf24", opacity: 0.5 }} />
          <span>Okay day (40–69)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#f87171", opacity: 0.5 }} />
          <span>Light day (0–39)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: "#a855f6" }} />
          <span>
            {avgMode === "7d" ? "7" : "30"}-day rolling avg
            <InfoTooltip>
              The average of your daily scores over the
              {avgMode === "7d" ? " last 7" : " last 30"} days.
              It smooths out day-to-day swings so you can
              see your overall trend.
            </InfoTooltip>
          </span>
        </div>
      </div>

      {/* Chart: daily score bars + rolling avg trend line */}
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
            <Tooltip content={<CustomTooltip thresholds={summary.thresholds} />} />
            <Bar
              dataKey="score"
              radius={[2, 2, 0, 0]}
              barSize={10}
              opacity={0.7}
              cursor={onDayClick ? "pointer" : "default"}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={onDayClick ? (data: any) => { if (data?.date) onDayClick(data.date); } : undefined}
            >
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={scoreColor(entry.score)} fillOpacity={0.5} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="displayAvg"
              stroke="#a855f6"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 5,
                fill: "#a855f6",
                stroke: "#c084fc",
                strokeWidth: 2,
                cursor: onDayClick ? "pointer" : "default",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick: onDayClick ? (_event: any, payload: any) => { if (payload?.payload?.date) onDayClick(payload.payload.date); } : undefined,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </BentoCard>
  );
}
