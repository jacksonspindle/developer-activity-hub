"use client";

import { type LucideIcon } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { InfoTooltip } from "@/components/info-tooltip";

type StatColor = "green" | "blue" | "purple" | "orange" | "amber" | "cyan";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  info?: string;
  color?: StatColor;
}

const colorStyles: Record<StatColor, { bg: string; text: string; border: string; shadow: string }> = {
  green: { bg: "bg-green-500/[0.08]", text: "text-green-400", border: "border-green-500/[0.12]", shadow: "shadow-green-500/[0.04]" },
  blue: { bg: "bg-blue-500/[0.08]", text: "text-blue-400", border: "border-blue-500/[0.12]", shadow: "shadow-blue-500/[0.04]" },
  purple: { bg: "bg-purple-500/[0.08]", text: "text-purple-400", border: "border-purple-500/[0.12]", shadow: "shadow-purple-500/[0.04]" },
  orange: { bg: "bg-orange-500/[0.08]", text: "text-orange-400", border: "border-orange-500/[0.12]", shadow: "shadow-orange-500/[0.04]" },
  amber: { bg: "bg-amber-500/[0.08]", text: "text-amber-400", border: "border-amber-500/[0.12]", shadow: "shadow-amber-500/[0.04]" },
  cyan: { bg: "bg-cyan-500/[0.08]", text: "text-cyan-400", border: "border-cyan-500/[0.12]", shadow: "shadow-cyan-500/[0.04]" },
};

export function StatCard({ label, value, icon: Icon, info, color = "green" }: StatCardProps) {
  const styles = colorStyles[color];
  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-[#111827]/60 backdrop-blur-3xl p-4 shadow-xl transition-all duration-300 hover:bg-[#111827]/80 hover:border-white/[0.1]",
        "border-white/[0.06]",
        styles.shadow
      )}
    >
      <div className="pointer-events-none absolute inset-[1px] rounded-[15px] border border-white/[0.03]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="relative flex items-center gap-3">
        <div className={cn("rounded-xl p-2", styles.bg, styles.border, "border")}>
          <Icon className={cn("h-5 w-5", styles.text)} />
        </div>
        <div>
          <p className="text-2xl font-bold font-mono">{formatNumber(value)}</p>
          <p className="text-sm text-muted-foreground">
            {label}
            {info && <InfoTooltip text={info} />}
          </p>
        </div>
      </div>
    </div>
  );
}
