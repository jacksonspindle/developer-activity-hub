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
import { Loader2, AlertTriangle, ChevronDown, ChevronUp, Clock, GitCommit, GitPullRequest, CircleDot, ExternalLink } from "lucide-react";

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

function GitHubSection({ github }: { github: GitHubDayActivity }) {
  const { commits, issues, pullRequests } = github;
  const hasActivity = commits.length > 0 || issues.length > 0 || pullRequests.length > 0;

  if (!hasActivity) return null;

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
        GitHub Activity
      </p>

      {/* Commits */}
      {commits.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <GitCommit className="h-3.5 w-3.5 text-green-400" />
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Commits ({commits.length})
            </p>
          </div>
          <div className="space-y-1.5">
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
        </div>
      )}

      {/* Pull Requests */}
      {pullRequests.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <GitPullRequest className="h-3.5 w-3.5 text-purple-400" />
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Pull Requests ({pullRequests.length})
            </p>
          </div>
          <div className="space-y-1.5">
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
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <CircleDot className="h-3.5 w-3.5 text-blue-400" />
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Issues ({issues.length})
            </p>
          </div>
          <div className="space-y-1.5">
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
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: ArchivedSession }) {
  const [expanded, setExpanded] = useState(false);
  const description = session.taskDescription || "";
  const isLong = description.length > 120;

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4 space-y-3">
      {/* Header: project + model */}
      <div className="flex items-start justify-between gap-2">
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
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
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

      {/* Initial prompt — labeled and expandable */}
      {description && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Initial Prompt</p>
          <p className={`text-xs text-gray-400 whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-3" : ""}`}>
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

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>
          <span className="text-green-400 font-mono">{formatNumber(session.totalTokens)}</span> tokens
        </span>
        <span>
          <span className="text-white/70 font-mono">{formatNumber(session.inputTokens)}</span> in
        </span>
        <span>
          <span className="text-white/70 font-mono">{formatNumber(session.outputTokens)}</span> out
        </span>
        {session.cacheReadTokens > 0 && (
          <span>
            <span className="text-blue-400/70 font-mono">{formatNumber(session.cacheReadTokens)}</span> cache
          </span>
        )}
        <span>
          <span className="text-white/70 font-mono">{session.userMessageCount}</span>/<span className="text-white/70 font-mono">{session.assistantMessageCount}</span> msgs
        </span>
        <span>
          <span className="text-white/70 font-mono">{session.toolCallCount}</span> tool calls
        </span>
      </div>

      {/* Files modified */}
      {session.filesModified.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Files Modified</p>
          <div className="flex flex-wrap gap-1">
            {session.filesModified.map((file) => (
              <span
                key={file}
                className="rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-400/80 font-mono"
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
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Tools Used</p>
          <div className="flex flex-wrap gap-1">
            {session.toolCalls.map((tool) => (
              <span
                key={tool}
                className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
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
      <DialogContent className="border-white/10 bg-[#0d1117] sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">
            {date ? formatFullDate(date) : ""}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Session activity for this day
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-green-400" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center text-red-400 text-sm">
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Summary bar */}
            <div className="grid grid-cols-4 gap-3">
              <SummaryItem label="Tokens" value={formatNumber(data.totalTokens)} />
              <SummaryItem
                label="Sessions"
                value={data.totalSessions.toLocaleString()}
                info="A session is a single Claude Code conversation — from the moment you open a chat to when it ends. Each session can include multiple back-and-forth messages."
              />
              <SummaryItem label="Messages" value={data.totalMessages.toLocaleString()} />
              <SummaryItem
                label="Tool Calls"
                value={data.totalToolCalls.toLocaleString()}
                info="Tool calls are actions Claude takes during a session, like reading files (Read), editing code (Edit), writing new files (Write), running shell commands (Bash), or searching (Grep/Glob)."
              />
            </div>

            {/* AI-generated day summary */}
            {data.daySummary && (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Day Summary</p>
                <p className="text-xs text-gray-300 leading-relaxed">{data.daySummary}</p>
              </div>
            )}

            {/* GitHub activity */}
            {data.github && <GitHubSection github={data.github} />}

            {/* No session data banner */}
            {!data.hasSessionData && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                <p className="text-xs text-yellow-300">
                  Detailed session data is not available for this day. Only aggregate
                  statistics are shown. Session-level data is archived going forward.
                </p>
              </div>
            )}

            {/* Session cards */}
            {data.sessions.length > 0 && (
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
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

function SummaryItem({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2 text-center">
      <p className="text-sm font-semibold text-green-400 font-mono">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
        {label}
        {info && <InfoTooltip text={info} />}
      </p>
    </div>
  );
}
