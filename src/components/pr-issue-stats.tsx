"use client";

import { BentoCard } from "@/components/bento-card";
import { DATA_COLORS } from "@/lib/utils";

interface PRIssueStatsProps {
  prsOpened: number;
  prsMerged: number;
  prsReviewed: number;
  issuesCreated: number;
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-center transition-all duration-200 hover:bg-white/[0.04]">
      <p className="text-2xl font-bold font-mono" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export function PRIssueStats({
  prsOpened,
  prsMerged,
  prsReviewed,
  issuesCreated,
}: PRIssueStatsProps) {
  const total = prsOpened + prsMerged + prsReviewed + issuesCreated;

  return (
    <BentoCard span={2} mobileSpan={2}>
      <div className="mb-3">
        <h3 className="text-lg font-semibold">PR & Issue Stats</h3>
        <p className="text-xs text-gray-500">Pull request and issue activity (90 days)</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <MiniStat label="PRs Opened" value={prsOpened} color={DATA_COLORS.pullRequests} />
        <MiniStat label="PRs Merged" value={prsMerged} color={DATA_COLORS.pullRequests} />
        <MiniStat label="PRs Reviewed" value={prsReviewed} color={DATA_COLORS.reviews} />
        <MiniStat label="Issues Created" value={issuesCreated} color={DATA_COLORS.issues} />
      </div>

      {total > 0 && (
        <div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.04] flex">
            {prsOpened > 0 && (
              <div
                className="h-full"
                style={{
                  width: `${(prsOpened / total) * 100}%`,
                  backgroundColor: DATA_COLORS.pullRequests,
                  opacity: 0.8,
                }}
              />
            )}
            {prsMerged > 0 && (
              <div
                className="h-full"
                style={{
                  width: `${(prsMerged / total) * 100}%`,
                  backgroundColor: DATA_COLORS.pullRequests,
                  opacity: 0.5,
                }}
              />
            )}
            {prsReviewed > 0 && (
              <div
                className="h-full"
                style={{
                  width: `${(prsReviewed / total) * 100}%`,
                  backgroundColor: DATA_COLORS.reviews,
                  opacity: 0.7,
                }}
              />
            )}
            {issuesCreated > 0 && (
              <div
                className="h-full"
                style={{
                  width: `${(issuesCreated / total) * 100}%`,
                  backgroundColor: DATA_COLORS.issues,
                  opacity: 0.7,
                }}
              />
            )}
          </div>
          <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DATA_COLORS.pullRequests }} />
              PRs
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DATA_COLORS.reviews }} />
              Reviews
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DATA_COLORS.issues }} />
              Issues
            </span>
          </div>
        </div>
      )}
    </BentoCard>
  );
}
