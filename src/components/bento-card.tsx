"use client";

import { cn } from "@/lib/utils";

type Variant = "default" | "hero-green" | "hero-blue" | "accent-purple" | "accent-orange";

interface BentoCardProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantOverlay: Record<Variant, string> = {
  default: "",
  "hero-green": "bg-gradient-to-br from-green-500/[0.08] via-green-500/[0.03] to-transparent",
  "hero-blue": "bg-gradient-to-br from-blue-500/[0.08] via-blue-500/[0.03] to-transparent",
  "accent-purple": "bg-gradient-to-br from-purple-500/[0.08] via-purple-500/[0.03] to-transparent",
  "accent-orange": "bg-gradient-to-br from-orange-500/[0.08] via-orange-500/[0.03] to-transparent",
};

const variantBorder: Record<Variant, string> = {
  default: "border-white/[0.06]",
  "hero-green": "border-green-500/[0.15]",
  "hero-blue": "border-blue-500/[0.15]",
  "accent-purple": "border-purple-500/[0.15]",
  "accent-orange": "border-orange-500/[0.15]",
};

const variantShadow: Record<Variant, string> = {
  default: "shadow-xl shadow-black/30",
  "hero-green": "shadow-xl shadow-green-500/[0.06]",
  "hero-blue": "shadow-xl shadow-blue-500/[0.06]",
  "accent-purple": "shadow-xl shadow-purple-500/[0.06]",
  "accent-orange": "shadow-xl shadow-orange-500/[0.06]",
};

export function BentoCard({
  children,
  variant = "default",
  className,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        "group relative h-full rounded-2xl border bg-[#111827]/60 backdrop-blur-3xl transition-all duration-300 hover:bg-[#111827]/80 hover:border-white/[0.1]",
        variantBorder[variant],
        variantShadow[variant],
        className
      )}
    >
      {/* Inner glow border */}
      <div className="pointer-events-none absolute inset-[1px] rounded-[15px] border border-white/[0.03]" />
      {/* Top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      {variant !== "default" && (
        <div className={cn("pointer-events-none absolute inset-0 rounded-2xl", variantOverlay[variant])} />
      )}
      <div className="relative h-full flex flex-col p-5">{children}</div>
    </div>
  );
}
