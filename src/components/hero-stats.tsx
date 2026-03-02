"use client";

import { BentoCard } from "@/components/bento-card";
import { formatNumber } from "@/lib/utils";

interface HeroStatsCardProps {
  totalTokens: number;
  totalCommits: number;
}

export function HeroStatsCard({ totalTokens, totalCommits }: HeroStatsCardProps) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <BentoCard variant="hero-green" className="flex-1">
        <div>
          <p className="text-2xl font-bold font-mono text-green-400">
            {formatNumber(totalTokens)}
          </p>
          <p className="text-sm text-muted-foreground">Total Tokens</p>
        </div>
      </BentoCard>
      <BentoCard variant="hero-blue" className="flex-1">
        <div>
          <p className="text-2xl font-bold font-mono text-blue-400">
            {formatNumber(totalCommits)}
          </p>
          <p className="text-sm text-muted-foreground">Total Commits</p>
        </div>
      </BentoCard>
    </div>
  );
}
