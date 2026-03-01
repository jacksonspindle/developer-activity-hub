"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { InfoTooltip } from "@/components/info-tooltip";
import { formatFullDate, formatNumber, getModelDisplayName, getModelColor } from "@/lib/utils";
import type { DayDetailResponse, ArchivedSession, GitHubDayActivity } from "@/lib/types";
import { Loader2, AlertTriangle, ChevronDown, ChevronUp, Clock, GitCommit, GitPullRequest, CircleDot, ExternalLink, Sparkles } from "lucide-react";

interface DayDetailModalProps {
  date: string | null;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  if (ms === 0) return "--";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function ActionBadge({ action, color }: { action: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    green: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
    gray: { bg: "bg-white/5", text: "text-gray-400", border: "border-white/10" },
  };
  const c = colorMap[color] || colorMap.gray;
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${c.bg} ${c.text} ${c.border}`}>
      {action}
    </span>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden ${className}`}>
      {/* Top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="p-3.5">
        {children}
      </div>
    </div>
  );
}

function GitHubSection({ github }: { github: GitHubDayActivity }) {
  const { commits, issues, pullRequests } = github;
  const hasActivity = commits.length > 0 || issues.length > 0 || pullRequests.length > 0;

  if (!hasActivity) return null;

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
        GitHub Activity
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Commits */}
        {commits.length > 0 && (
          <GlassCard className={pullRequests.length === 0 && issues.length === 0 ? "md:col-span-2" : ""}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="p-1 rounded-md bg-green-500/10 border border-green-500/20">
                <GitCommit className="h-3 w-3 text-green-400" />
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                Commits
              </p>
              <span className="ml-auto text-[10px] text-gray-500 font-mono">{commits.length}</span>
            </div>
            <div className="space-y-2">
              {commits.map((commit) => (
                <div key={commit.sha} className="flex items-start gap-2 group">
                  <code className="text-[10px] text-gray-500 font-mono shrink-0 mt-0.5">
                    {commit.sha}
                  </code>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-300 truncate">{commit.message}</p>
                    <p className="text-[10px] text-gray-500">{commit.repo}</p>
                  </div>
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="h-3 w-3 text-gray-500 hover:text-gray-300" />
                  </a>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Pull Requests */}
        {pullRequests.length > 0 && (
          <GlassCard className={commits.length === 0 && issues.length === 0 ? "md:col-span-2" : ""}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="p-1 rounded-md bg-purple-500/10 border border-purple-500/20">
                <GitPullRequest className="h-3 w-3 text-purple-400" />
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                Pull Requests
              </p>
              <span className="ml-auto text-[10px] text-gray-500 font-mono">{pullRequests.length}</span>
            </div>
            <div className="space-y-2">
              {pullRequests.map((pr) => (
                <div key={`${pr.repo}#${pr.number}`} className="flex items-start gap-2 group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-gray-300 truncate">{pr.title}</p>
                      <ActionBadge
                        action={pr.action}
                        color={pr.action === "merged" ? "purple" : pr.action === "opened" ? "green" : "blue"}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500">{pr.repo}#{pr.number}</p>
                  </div>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="h-3 w-3 text-gray-500 hover:text-gray-300" />
                  </a>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Issues */}
        {issues.length > 0 && (
          <GlassCard className={commits.length === 0 && pullRequests.length === 0 ? "md:col-span-2" : ""}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="p-1 rounded-md bg-orange-500/10 border border-orange-500/20">
                <CircleDot className="h-3 w-3 text-orange-400" />
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                Issues
              </p>
              <span className="ml-auto text-[10px] text-gray-500 font-mono">{issues.length}</span>
            </div>
            <div className="space-y-2">
              {issues.map((issue) => (
                <div key={`${issue.repo}#${issue.number}`} className="flex items-start gap-2 group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-gray-300 truncate">{issue.title}</p>
                      <ActionBadge
                        action={issue.action}
                        color={issue.action === "created" ? "green" : "yellow"}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500">{issue.repo}#{issue.number}</p>
                  </div>
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="h-3 w-3 text-gray-500 hover:text-gray-300" />
                  </a>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: ArchivedSession }) {
  const [expanded, setExpanded] = useState(false);
  const description = session.taskDescription || "";
  const isLong = description.length > 120;

  return (
    <GlassCard>
      {/* Header: project + model */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {session.project}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {session.durationMs > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Clock className="h-3 w-3" />
              {formatDuration(session.durationMs)}
            </span>
          )}
          {session.model && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm"
              style={{
                color: getModelColor(session.model),
                backgroundColor: getModelColor(session.model) + "15",
                border: `1px solid ${getModelColor(session.model)}30`,
              }}
            >
              {getModelDisplayName(session.model)}
            </span>
          )}
        </div>
      </div>

      {/* Initial prompt */}
      {description && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-medium">Initial Prompt</p>
          <p className={`text-xs text-gray-400 whitespace-pre-wrap leading-relaxed ${!expanded && isLong ? "line-clamp-3" : ""}`}>
            {description}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 flex items-center gap-0.5 text-[10px] text-green-400/70 hover:text-green-400 transition-colors"
            >
              {expanded ? (
                <>Show less <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Show more <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          )}
        </div>
      )}

      {/* Stats row — mini bento grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 mb-3">
        <MiniStat label="Tokens" value={formatNumber(session.totalTokens)} color="text-green-400" />
        <MiniStat label="In" value={formatNumber(session.inputTokens)} color="text-gray-300" />
        <MiniStat label="Out" value={formatNumber(session.outputTokens)} color="text-gray-300" />
        {session.cacheReadTokens > 0 && (
          <MiniStat label="Cache" value={formatNumber(session.cacheReadTokens)} color="text-blue-400" />
        )}
        <MiniStat label="Messages" value={`${session.userMessageCount}/${session.assistantMessageCount}`} color="text-gray-300" />
        <MiniStat label="Tools" value={String(session.toolCallCount)} color="text-gray-300" />
      </div>

      {/* Files modified */}
      {session.filesModified.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">Files Modified</p>
          <div className="flex flex-wrap gap-1">
            {session.filesModified.map((file) => (
              <span
                key={file}
                className="rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-400/80 font-mono backdrop-blur-sm"
              >
                {file}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tool tags */}
      {session.toolCalls.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">Tools Used</p>
          <div className="flex flex-wrap gap-1">
            {session.toolCalls.map((tool) => (
              <span
                key={tool}
                className="rounded-md bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-gray-400 backdrop-blur-sm"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2 py-1.5 text-center">
      <p className={`text-xs font-semibold font-mono ${color}`}>{value}</p>
      <p className="text-[8px] text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export function DayDetailModal({ date, onClose }: DayDetailModalProps) {
  const [data, setData] = useState<DayDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/day-detail?date=${date}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/[0.08] bg-[#0c1220]/80 backdrop-blur-3xl sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-black/60">
        {/* Top highlight line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
        {/* Subtle inner glow */}
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b from-white/[0.02] to-transparent" />

        <DialogHeader className="relative">
          <DialogTitle className="text-white text-lg">
            {date ? formatFullDate(date) : ""}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Activity breakdown for this day
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="relative">
              <Loader2 className="h-7 w-7 animate-spin text-green-400" />
              <div className="absolute inset-0 h-7 w-7 animate-ping rounded-full bg-green-400/20" />
            </div>
          </div>
        )}

        {error && (
          <GlassCard className="border-red-500/20">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          </GlassCard>
        )}

        {data && !loading && (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1 relative">
            {/* Summary bento grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="Tokens"
                value={formatNumber(data.totalTokens)}
                color="text-green-400"
                glowColor="green"
              />
              <SummaryCard
                label="Sessions"
                value={data.totalSessions.toLocaleString()}
                color="text-blue-400"
                glowColor="blue"
                info="A session is a single Claude Code conversation — from the moment you open a chat to when it ends."
              />
              <SummaryCard
                label="Messages"
                value={data.totalMessages.toLocaleString()}
                color="text-purple-400"
                glowColor="purple"
              />
              <SummaryCard
                label="Tool Calls"
                value={data.totalToolCalls.toLocaleString()}
                color="text-amber-400"
                glowColor="amber"
                info="Actions Claude takes during a session, like reading files, editing code, writing files, or running commands."
              />
            </div>

            {/* AI-generated day summary */}
            {data.daySummary && (
              <GlassCard>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="p-1 rounded-md bg-purple-500/10 border border-purple-500/20">
                    <Sparkles className="h-3 w-3 text-purple-400" />
                  </div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Day Summary</p>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{data.daySummary}</p>
              </GlassCard>
            )}

            {/* GitHub activity */}
            {data.github && <GitHubSection github={data.github} />}

            {/* No session data banner */}
            {!data.hasSessionData && (
              <GlassCard className="border-yellow-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                  <p className="text-xs text-yellow-300/80 leading-relaxed">
                    Detailed session data is not available for this day. Only aggregate
                    statistics are shown. Session-level data is archived going forward.
                  </p>
                </div>
              </GlassCard>
            )}

            {/* Session cards */}
            {data.sessions.length > 0 && (
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                Sessions ({data.sessions.length})
              </p>
            )}
            {data.sessions.map((session) => (
              <SessionCard key={session.sessionId} session={session} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  color,
  glowColor,
  info,
}: {
  label: string;
  value: string;
  color: string;
  glowColor: string;
  info?: string;
}) {
  const glowMap: Record<string, string> = {
    green: "shadow-green-500/5",
    blue: "shadow-blue-500/5",
    purple: "shadow-purple-500/5",
    amber: "shadow-amber-500/5",
  };
  const borderMap: Record<string, string> = {
    green: "border-green-500/10",
    blue: "border-blue-500/10",
    purple: "border-purple-500/10",
    amber: "border-amber-500/10",
  };

  return (
    <div className={`relative rounded-xl bg-white/[0.03] border ${borderMap[glowColor] || "border-white/[0.06]"} backdrop-blur-xl p-3 text-center shadow-lg ${glowMap[glowColor] || ""} overflow-hidden`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
        {label}
        {info && <InfoTooltip text={info} />}
      </p>
    </div>
  );
}
