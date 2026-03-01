"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { BentoCard } from "@/components/bento-card";
import { formatDate, formatFullDate, formatNumber, DATA_COLORS, cn } from "@/lib/utils";
import type { CombinedDailyData } from "@/lib/github-types";

interface CombinedTimelineProps {
  data: CombinedDailyData[];
  onDayClick?: (date: string) => void;
}

type TimeRange = "30d" | "90d" | "all";

const RANGE_OPTIONS: { key: TimeRange; label: string }[] = [
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "all", label: "All Time" },
];

interface SeriesToggle {
  key: string;
  label: string;
  color: string;
  defaultOn: boolean;
}

const SERIES: SeriesToggle[] = [
  { key: "tokens", label: "Tokens", color: DATA_COLORS.claude, defaultOn: true },
  { key: "commits", label: "Commits", color: DATA_COLORS.commits, defaultOn: true },
  { key: "prsOpened", label: "PRs", color: DATA_COLORS.pullRequests, defaultOn: true },
  { key: "issuesCreated", label: "Issues", color: DATA_COLORS.issues, defaultOn: false },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0c1220]/95 backdrop-blur-2xl px-3 py-2 shadow-2xl shadow-black/60" style={{ zIndex: 99999 }}>
      <p className="text-xs text-gray-400 mb-1">{formatFullDate(label)}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm" style={{ color: entry.color }}>
          {entry.dataKey === "tokens"
            ? `${formatNumber(entry.value)} tokens`
            : `${entry.value} ${entry.dataKey.replace(/([A-Z])/g, " $1").toLowerCase()}`}
        </p>
      ))}
      <p className="mt-1 text-[10px] text-gray-500">Click for details</p>
    </div>
  );
}

export function CombinedTimeline({ data, onDayClick }: CombinedTimelineProps) {
  const [range, setRange] = useState<TimeRange>("all");
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    new Set(SERIES.filter((s) => s.defaultOn).map((s) => s.key))
  );

  const filteredData = useMemo(() => {
    // Build a lookup from existing data
    const lookup = new Map<string, CombinedDailyData>();
    for (const d of data) lookup.set(d.date, d);

    // Determine date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let startDate: Date;

    if (range === "all") {
      // Find the earliest date across all data
      if (data.length === 0) return [];
      startDate = new Date(data[0].date + "T00:00:00");
    } else {
      const days = range === "30d" ? 30 : 90;
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - days);
    }

    // Fill in every date in the range
    const result: CombinedDailyData[] = [];
    const d = new Date(startDate);
    while (d <= today) {
      const dateStr = d.toLocaleDateString("en-CA");
      const existing = lookup.get(dateStr);
      result.push(existing ?? {
        date: dateStr,
        tokens: 0,
        commits: 0,
        prsOpened: 0,
        prsMerged: 0,
        issuesCreated: 0,
      });
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [data, range]);

  const toggleSeries = (key: string) => {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDotClick = (_event: any, payload: any) => {
    if (payload?.payload?.date && onDayClick) {
      onDayClick(payload.payload.date);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (data: any) => {
    if (data?.date && onDayClick) {
      onDayClick(data.date);
    }
  };

  const showTokens = visibleSeries.has("tokens");
  const showCommits = visibleSeries.has("commits");
  const showPRs = visibleSeries.has("prsOpened");
  const showIssues = visibleSeries.has("issuesCreated");

  return (
    <BentoCard>
      {/* Header with controls */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Combined Activity</h3>
          <p className="text-xs text-gray-500">Click any point for details</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Series toggles */}
          <div className="flex items-center gap-2">
            {SERIES.map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSeries(s.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-all border",
                  visibleSeries.has(s.key)
                    ? "border-white/[0.12] bg-white/[0.06]"
                    : "border-white/[0.04] bg-transparent opacity-40"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color, opacity: visibleSeries.has(s.key) ? 1 : 0.3 }}
                />
                {s.label}
              </button>
            ))}
          </div>

          {/* Time range */}
          <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  range === opt.key
                    ? "bg-white/[0.1] text-white"
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={filteredData}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <defs>
              <linearGradient id="tokenGradientCombined" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DATA_COLORS.claude} stopOpacity={0.25} />
                <stop offset="100%" stopColor={DATA_COLORS.claude} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="issueGradientCombined" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DATA_COLORS.issues} stopOpacity={0.25} />
                <stop offset="100%" stopColor={DATA_COLORS.issues} stopOpacity={0} />
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
              yAxisId="tokens"
              tickFormatter={formatNumber}
              stroke="rgba(255,255,255,0.15)"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              orientation="left"
              hide={!showTokens}
            />
            <YAxis
              yAxisId="activity"
              stroke="rgba(255,255,255,0.15)"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              orientation="right"
              hide={!showCommits && !showPRs && !showIssues}
            />
            <Tooltip content={<CustomTooltip />} />
            {showTokens && (
              <Area
                yAxisId="tokens"
                type="monotone"
                dataKey="tokens"
                stroke={DATA_COLORS.claude}
                strokeWidth={2}
                fill="url(#tokenGradientCombined)"
                dot={{ r: 2, fill: DATA_COLORS.claude, stroke: DATA_COLORS.claude, strokeWidth: 0 }}
                activeDot={{
                  r: 6,
                  fill: DATA_COLORS.claude,
                  stroke: "#22c55e",
                  strokeWidth: 2,
                  cursor: onDayClick ? "pointer" : "default",
                  onClick: onDayClick ? handleDotClick : undefined,
                }}
              />
            )}
            {showCommits && (
              <Bar
                yAxisId="activity"
                dataKey="commits"
                fill={DATA_COLORS.commits}
                radius={[2, 2, 0, 0]}
                opacity={0.7}
                barSize={8}
                cursor={onDayClick ? "pointer" : "default"}
                onClick={onDayClick ? handleBarClick : undefined}
              />
            )}
            {showPRs && (
              <Line
                yAxisId="activity"
                type="monotone"
                dataKey="prsOpened"
                stroke={DATA_COLORS.pullRequests}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: DATA_COLORS.pullRequests,
                  stroke: "#a855f6",
                  strokeWidth: 2,
                  cursor: onDayClick ? "pointer" : "default",
                  onClick: onDayClick ? handleDotClick : undefined,
                }}
              />
            )}
            {showIssues && (
              <Area
                yAxisId="activity"
                type="monotone"
                dataKey="issuesCreated"
                stroke={DATA_COLORS.issues}
                strokeWidth={2}
                fill="url(#issueGradientCombined)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: DATA_COLORS.issues,
                  stroke: "#ea580c",
                  strokeWidth: 2,
                  cursor: onDayClick ? "pointer" : "default",
                  onClick: onDayClick ? handleDotClick : undefined,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </BentoCard>
  );
}
