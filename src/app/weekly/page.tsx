"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { formatNumber, formatDate, formatFullDate, cn } from "@/lib/utils";
import { getCurrentWeekString, offsetWeek } from "@/lib/week-utils";
import type { WeeklyDigestResponse, WeeklyScoreDay } from "@/lib/weekly-types";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trophy,
  FolderKanban,
  GitPullRequest,
  FileCode2,
  DollarSign,
  TrendingUp,
  Loader2,
} from "lucide-react";

function scoreColor(score: number): string {
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
}

function scoreColorClass(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function ScoreTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: WeeklyScoreDay }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const daily = payload[0].payload;

  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0c1220]/95 backdrop-blur-2xl px-3 py-2.5 shadow-2xl shadow-black/60 min-w-[140px]">
      <p className="text-xs text-gray-400 mb-1">{formatFullDate(label)}</p>
      <p className="text-lg font-bold" style={{ color: scoreColor(daily.score) }}>
        {Math.round(daily.score)}
      </p>
      <p className="text-[10px] text-gray-500">7d avg: {Math.round(daily.avg7d)}</p>
    </div>
  );
}

function DeltaBadge({ deltaPct }: { deltaPct: number }) {
  if (deltaPct === 0) return <span className="text-[10px] text-gray-500">—</span>;
  const isUp = deltaPct > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        isUp ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
      )}
    >
      {isUp ? "↑" : "↓"}{Math.abs(deltaPct)}%
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms === 0) return "--";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function WeeklyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<WeeklyDigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentWeek = searchParams.get("week") || getCurrentWeekString();

  const fetchWeek = useCallback((week: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/weekly-digest?week=${week}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWeek(currentWeek);
  }, [currentWeek, fetchWeek]);

  const navigate = (week: string) => {
    router.push(`/weekly?week=${week}`);
  };

  const isCurrentWeek = currentWeek === getCurrentWeekString();

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(168,85,247,0.04)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_50%,rgba(96,165,250,0.02)_0%,transparent_60%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </a>

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Weekly Digest</h1>

            {/* Week navigator */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(offsetWeek(currentWeek, -1))}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-sm font-medium text-gray-200 min-w-[200px] text-center">
                {data?.week.label ?? currentWeek}
              </span>

              <button
                onClick={() => navigate(offsetWeek(currentWeek, 1))}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {!isCurrentWeek && (
                <button
                  onClick={() => navigate(getCurrentWeekString())}
                  className="rounded-lg border border-purple-500/20 bg-purple-500/[0.06] px-3 py-2 text-xs text-purple-400 hover:bg-purple-500/[0.1] transition-all"
                >
                  This Week
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="relative">
              <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
              <div className="absolute inset-0 h-7 w-7 animate-ping rounded-full bg-purple-400/20" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] backdrop-blur-2xl p-4 text-center text-red-400">
            {error}
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <div className="space-y-6">
            {/* AI Summary */}
            {data.aiSummary && (
              <BentoCard variant="accent-purple">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-purple-300">Week in Review</h3>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{data.aiSummary}</p>
              </BentoCard>
            )}

            {/* Week-over-Week Deltas */}
            {data.deltas.length > 0 && (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {data.deltas.map((delta) => (
                  <div
                    key={delta.label}
                    className="rounded-xl border border-white/[0.06] bg-card backdrop-blur-3xl p-3 text-center"
                  >
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                      {delta.label}
                    </p>
                    <p className="text-lg font-bold tabular-nums text-white">
                      {delta.label === "Tokens" ? formatNumber(delta.current) : delta.current}
                    </p>
                    <DeltaBadge deltaPct={delta.deltaPct} />
                  </div>
                ))}
              </div>
            )}

            {/* Score Trend */}
            <BentoCard>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                </div>
                <h3 className="text-sm font-semibold">Score Trend</h3>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#4ade80", opacity: 0.5 }} />
                  <span>Great (70+)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#fbbf24", opacity: 0.5 }} />
                  <span>Okay (40–69)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#f87171", opacity: 0.5 }} />
                  <span>Light (0–39)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: "#a855f6" }} />
                  <span>7d avg</span>
                </div>
              </div>

              <div className="h-[220px] w-full">
                {data.scores.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={data.scores}
                      margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d: string) => {
                          const day = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                          return day;
                        }}
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
                      />
                      <Tooltip content={<ScoreTooltip />} />
                      <Bar
                        dataKey="score"
                        radius={[4, 4, 0, 0]}
                        barSize={32}
                        opacity={0.7}
                      >
                        {data.scores.map((entry, idx) => (
                          <Cell key={idx} fill={scoreColor(entry.score)} fillOpacity={0.5} />
                        ))}
                      </Bar>
                      <Line
                        type="monotone"
                        dataKey="avg7d"
                        stroke="#a855f6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-gray-500">
                    No score data for this week
                  </div>
                )}
              </div>
            </BentoCard>

            {/* Two-column: Top Days + PRs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 3 Days */}
              <BentoCard>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Trophy className="h-4 w-4 text-amber-400" />
                  </div>
                  <h3 className="text-sm font-semibold">Top Days</h3>
                </div>
                {data.topDays.length > 0 ? (
                  <div className="space-y-3">
                    {data.topDays.map((day, i) => (
                      <div
                        key={day.date}
                        className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
                      >
                        <span className="text-lg font-bold text-gray-500 w-6 text-center tabular-nums">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400">{formatFullDate(day.date)}</p>
                          <p className="text-[11px] text-gray-500 truncate">{day.highlight}</p>
                        </div>
                        <span
                          className={cn("text-lg font-bold tabular-nums", scoreColorClass(day.score))}
                        >
                          {Math.round(day.score)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center">No scored days this week</p>
                )}
              </BentoCard>

              {/* PRs Shipped */}
              <BentoCard variant="accent-purple">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <GitPullRequest className="h-4 w-4 text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold">PRs Shipped</h3>
                </div>
                {data.prsMerged.length > 0 ? (
                  <div className="space-y-2">
                    {data.prsMerged.map((pr) => (
                      <a
                        key={`${pr.repo}#${pr.number}`}
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-300 group-hover:text-white transition-colors truncate">
                            {pr.title}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {pr.repo}#{pr.number}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center">No PRs merged this week</p>
                )}
              </BentoCard>
            </div>

            {/* Projects Touched */}
            {data.projects.length > 0 && (
              <BentoCard variant="hero-green">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                    <FolderKanban className="h-4 w-4 text-green-400" />
                  </div>
                  <h3 className="text-sm font-semibold">Projects Touched</h3>
                </div>
                <div className="space-y-3">
                  {data.projects.map((project) => {
                    const maxTokens = data.projects[0].totalTokens;
                    const pct = maxTokens > 0 ? (project.totalTokens / maxTokens) * 100 : 0;
                    return (
                      <div key={project.project} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-200 truncate">
                            {project.project}
                          </span>
                          <div className="flex items-center gap-3 text-[10px] text-gray-500 shrink-0">
                            <span>{project.sessionCount} sessions</span>
                            <span>{formatDuration(project.totalDurationMs)}</span>
                            <span className="text-green-400 font-medium">
                              {formatNumber(project.totalTokens)} tokens
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-400/50"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </BentoCard>
            )}

            {/* Two-column: Hotspot Files + Cost */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hotspot Files */}
              {data.hotspotFiles.length > 0 && (
                <BentoCard>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <FileCode2 className="h-4 w-4 text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold">Hotspot Files</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.hotspotFiles.map((f) => (
                      <span
                        key={f.file}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[10px] text-blue-400/80 font-mono"
                      >
                        {f.file}
                        <span className="text-blue-400/40">{f.count}x</span>
                      </span>
                    ))}
                  </div>
                </BentoCard>
              )}

              {/* Cost Breakdown */}
              <BentoCard variant="accent-orange">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <DollarSign className="h-4 w-4 text-orange-400" />
                    </div>
                    <h3 className="text-sm font-semibold">Cost Breakdown</h3>
                  </div>
                  <span className="text-lg font-bold text-orange-400 tabular-nums">
                    ${data.totalCostUSD.toFixed(2)}
                  </span>
                </div>
                {data.cost.length > 0 ? (
                  <div className="space-y-2.5">
                    {data.cost.map((item) => {
                      const maxCost = data.cost[0].costUSD;
                      const pct = maxCost > 0 ? (item.costUSD / maxCost) * 100 : 0;
                      return (
                        <div key={item.model} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium" style={{ color: item.color }}>
                              {item.displayName}
                            </span>
                            <span className="text-gray-400 tabular-nums">
                              ${item.costUSD.toFixed(2)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: item.color, opacity: 0.5 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center">No cost data this week</p>
                )}
              </BentoCard>
            </div>

            {/* Empty week message */}
            {data.activeDates.length === 0 && !data.aiSummary && (
              <div className="rounded-2xl border border-white/[0.06] bg-card backdrop-blur-3xl p-8 text-center">
                <p className="text-gray-500">No activity recorded for this week</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WeeklyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
        </div>
      }
    >
      <WeeklyContent />
    </Suspense>
  );
}
