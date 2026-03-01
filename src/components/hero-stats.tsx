"use client";

import { BentoCard } from "@/components/bento-card";
import { formatNumber } from "@/lib/utils";

interface HeroTokensCardProps {
  totalTokens: number;
}

export function HeroTokensCard({ totalTokens }: HeroTokensCardProps) {
  return (
    <BentoCard variant="hero-green">
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-5xl font-bold tracking-tight text-green-400 font-mono md:text-6xl drop-shadow-[0_0_30px_rgba(74,222,128,0.2)]">
          {formatNumber(totalTokens)}
        </p>
        <p className="mt-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Total Tokens
        </p>
      </div>
    </BentoCard>
  );
}

interface HeroCommitsCardProps {
  totalCommits: number;
}

export function HeroCommitsCard({ totalCommits }: HeroCommitsCardProps) {
  return (
    <BentoCard variant="hero-blue">
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-5xl font-bold tracking-tight text-blue-400 font-mono md:text-6xl drop-shadow-[0_0_30px_rgba(96,165,250,0.2)]">
          {formatNumber(totalCommits)}
        </p>
        <p className="mt-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Total Commits
        </p>
      </div>
    </BentoCard>
  );
}
