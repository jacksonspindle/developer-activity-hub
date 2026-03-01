"use client";

import { useState } from "react";
import { BentoCard } from "@/components/bento-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DATA_COLORS } from "@/lib/utils";
import { ExternalLink, GitPullRequest, CircleDot } from "lucide-react";
import type { PRDetailItem, IssueDetailItem } from "@/lib/github-types";

type StatCategory = "prsOpened" | "prsMerged" | "prsReviewed" | "issuesCreated";

interface PRIssueStatsProps {
  prsOpened: number;
  prsMerged: number;
  prsReviewed: number;
  issuesCreated: number;
  items?: {
    prsOpened: PRDetailItem[];
    prsMerged: PRDetailItem[];
    prsReviewed: PRDetailItem[];
    issuesCreated: IssueDetailItem[];
  };
}

const CATEGORY_META: Record<
  StatCategory,
  { label: string; icon: typeof GitPullRequest; iconColor: string; badgeBg: string; badgeBorder: string }
> = {
  prsOpened: {
    label: "PRs Opened",
    icon: GitPullRequest,
    iconColor: "text-purple-400",
    badgeBg: "bg-purple-500/10",
    badgeBorder: "border-purple-500/20",
  },
  prsMerged: {
    label: "PRs Merged",
    icon: GitPullRequest,
    iconColor: "text-purple-400",
    badgeBg: "bg-purple-500/10",
    badgeBorder: "border-purple-500/20",
  },
  prsReviewed: {
    label: "PRs Reviewed",
    icon: GitPullRequest,
    iconColor: "text-cyan-400",
    badgeBg: "bg-cyan-500/10",
    badgeBorder: "border-cyan-500/20",
  },
  issuesCreated: {
    label: "Issues Created",
    icon: CircleDot,
    iconColor: "text-orange-400",
    badgeBg: "bg-orange-500/10",
    badgeBorder: "border-orange-500/20",
  },
};

function MiniStat({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-center transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.15] cursor-pointer"
    >
      <p className="text-2xl font-bold font-mono" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </button>
  );
}

function StateBadge({ state }: { state: string }) {
  const isOpen = state === "open";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${
        isOpen
          ? "bg-green-500/10 text-green-400 border-green-500/20"
          : "bg-purple-500/10 text-purple-400 border-purple-500/20"
      }`}
    >
      {state}
    </span>
  );
}

function DetailModal({
  category,
  onClose,
  items,
}: {
  category: StatCategory | null;
  onClose: () => void;
  items: PRIssueStatsProps["items"];
}) {
  if (!category || !items) return null;

  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const list = items[category];

  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/[0.08] bg-[#0c1220]/80 backdrop-blur-3xl sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-black/60">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b from-white/[0.02] to-transparent" />

        <DialogHeader className="relative">
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            <div className={`p-1 rounded-md ${meta.badgeBg} border ${meta.badgeBorder}`}>
              <Icon className={`h-4 w-4 ${meta.iconColor}`} />
            </div>
            {meta.label}
            <span className="text-sm text-gray-500 font-mono ml-auto">{list.length}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Last 90 days
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto pr-1 space-y-1.5 -mx-1 px-1">
          {list.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No items</p>
          )}
          {(list as (PRDetailItem | IssueDetailItem)[]).map((item) => (
            <a
              key={`${item.repo}#${item.number}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 group hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs text-gray-200 truncate font-medium">
                    {item.title}
                  </p>
                  <StateBadge state={item.state} />
                </div>
                <p className="text-[10px] text-gray-500">
                  {item.repo}#{item.number}
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0 mt-0.5" />
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PRIssueStats({
  prsOpened,
  prsMerged,
  prsReviewed,
  issuesCreated,
  items,
}: PRIssueStatsProps) {
  const [activeCategory, setActiveCategory] = useState<StatCategory | null>(null);
  const total = prsOpened + prsMerged + prsReviewed + issuesCreated;

  return (
    <>
      <BentoCard span={2} mobileSpan={2}>
        <div className="mb-3">
          <h3 className="text-lg font-semibold">PR & Issue Stats</h3>
          <p className="text-xs text-gray-500">Pull request and issue activity (90 days)</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <MiniStat
            label="PRs Opened"
            value={prsOpened}
            color={DATA_COLORS.pullRequests}
            onClick={() => setActiveCategory("prsOpened")}
          />
          <MiniStat
            label="PRs Merged"
            value={prsMerged}
            color={DATA_COLORS.pullRequests}
            onClick={() => setActiveCategory("prsMerged")}
          />
          <MiniStat
            label="PRs Reviewed"
            value={prsReviewed}
            color={DATA_COLORS.reviews}
            onClick={() => setActiveCategory("prsReviewed")}
          />
          <MiniStat
            label="Issues Created"
            value={issuesCreated}
            color={DATA_COLORS.issues}
            onClick={() => setActiveCategory("issuesCreated")}
          />
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

      <DetailModal
        category={activeCategory}
        onClose={() => setActiveCategory(null)}
        items={items}
      />
    </>
  );
}
