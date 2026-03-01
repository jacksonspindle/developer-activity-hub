"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { BentoCard } from "@/components/bento-card";
import { cn, formatNumber } from "@/lib/utils";
import type { StreakData, Achievement } from "@/lib/github-types";

interface StreakAchievementsProps {
  streaks: StreakData;
  achievements: Achievement[];
}

function AchievementBadge({ a }: { a: Achievement }) {
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);
  const unlocked = !!a.unlockedAt;

  const tooltipText = unlocked
    ? `${a.title} — ${a.description}`
    : a.progress
      ? `${a.title} — ${a.description} (${formatNumber(a.progress.current)}/${formatNumber(a.progress.target)})`
      : `${a.title} — ${a.description}`;

  return (
    <>
      <div
        className={cn(
          "rounded-xl border p-2 text-center transition-all duration-200 cursor-default",
          unlocked
            ? "border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/[0.15]"
            : "border-white/[0.04] bg-white/[0.01] opacity-40 hover:opacity-60"
        )}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHovered({ x: rect.left + rect.width / 2, y: rect.top });
        }}
        onMouseLeave={() => setHovered(null)}
      >
        <span className={cn("text-xl", !unlocked && "grayscale")}>{a.icon}</span>
        <p className="text-[8px] font-medium mt-0.5 truncate text-muted-foreground">{a.title}</p>
        {!unlocked && a.progress && (
          <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-400/50"
              style={{
                width: `${Math.min(100, (a.progress.current / a.progress.target) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Tooltip via portal */}
      {hovered &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed rounded-xl border border-white/[0.12] bg-[#0c1220]/95 backdrop-blur-2xl px-3 py-2 shadow-2xl shadow-black/60 pointer-events-none max-w-[220px]"
            style={{
              left: hovered.x,
              top: hovered.y - 8,
              transform: "translate(-50%, -100%)",
              zIndex: 99999,
            }}
          >
            <p className="text-[11px] text-gray-200 font-medium mb-0.5">{a.icon} {a.title}</p>
            <p className="text-[10px] text-gray-400">{a.description}</p>
            {unlocked && (
              <p className="text-[10px] text-green-400 mt-1 font-medium">Unlocked!</p>
            )}
            {!unlocked && a.progress && (
              <div className="mt-1.5">
                <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
                  <span>Progress</span>
                  <span>{formatNumber(a.progress.current)} / {formatNumber(a.progress.target)}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-400/60"
                    style={{
                      width: `${Math.min(100, (a.progress.current / a.progress.target) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

export function StreakAchievements({ streaks, achievements }: StreakAchievementsProps) {
  return (
    <BentoCard>
      {/* Streaks */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Streaks</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-4 text-center">
            <span className="text-2xl">🔥</span>
            <p className="text-3xl font-bold text-amber-400 font-mono mt-1 drop-shadow-[0_0_12px_rgba(251,191,36,0.15)]">
              {streaks.currentCombined.days}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Current Streak</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
            <span className="text-2xl">🏆</span>
            <p className="text-3xl font-bold text-muted-foreground font-mono mt-1">
              {streaks.longestCombined.days}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Longest Streak</p>
          </div>
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground mt-3 px-1">
          <span>GitHub only: {streaks.current.days}d current / {streaks.longest.days}d best</span>
        </div>
      </div>

      {/* Achievements */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Achievements</h3>
        <div className="grid grid-cols-5 gap-2">
          {achievements.map((a) => (
            <AchievementBadge key={a.id} a={a} />
          ))}
        </div>
      </div>
    </BentoCard>
  );
}
