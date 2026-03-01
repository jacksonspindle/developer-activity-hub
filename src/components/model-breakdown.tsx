"use client";

import { BentoCard } from "@/components/bento-card";
import { formatNumber, getModelDisplayName, getModelColor } from "@/lib/utils";
import type { ModelUsageStats } from "@/lib/types";

interface ModelBreakdownProps {
  modelUsage: Record<string, ModelUsageStats>;
}

export function ModelBreakdown({ modelUsage }: ModelBreakdownProps) {
  const models = Object.entries(modelUsage).sort((a, b) => {
    const totalA = a[1].inputTokens + a[1].outputTokens + a[1].cacheReadInputTokens + a[1].cacheCreationInputTokens;
    const totalB = b[1].inputTokens + b[1].outputTokens + b[1].cacheReadInputTokens + b[1].cacheCreationInputTokens;
    return totalB - totalA;
  });

  const grandTotal = models.reduce((sum, [, stats]) => {
    return sum + stats.inputTokens + stats.outputTokens + stats.cacheReadInputTokens + stats.cacheCreationInputTokens;
  }, 0);

  return (
    <BentoCard>
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Model Breakdown</h3>
        <p className="text-xs text-gray-500">Token usage by model</p>
      </div>
      <div className="space-y-5">
        {models.map(([modelId, stats]) => {
          const total = stats.inputTokens + stats.outputTokens + stats.cacheReadInputTokens + stats.cacheCreationInputTokens;
          const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
          const color = getModelColor(modelId);

          return (
            <div key={modelId} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium">
                    {getModelDisplayName(modelId)}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                  {formatNumber(total)} ({pct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}80)`,
                  }}
                />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Input: {formatNumber(stats.inputTokens)}</span>
                <span>Output: {formatNumber(stats.outputTokens)}</span>
                <span>Cache Read: {formatNumber(stats.cacheReadInputTokens)}</span>
                <span>Cache Write: {formatNumber(stats.cacheCreationInputTokens)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
