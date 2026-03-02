"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { BentoCard } from "@/components/bento-card";
import { formatHour } from "@/lib/utils";

interface ActivityHeatmapProps {
  hourCounts: Record<string, number>;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0c1220]/95 backdrop-blur-2xl px-3 py-2 shadow-2xl shadow-black/60" style={{ zIndex: 99999 }}>
      <p className="text-xs text-gray-400">{formatHour(Number(label))}</p>
      <p className="text-sm font-semibold text-green-400">
        {payload[0].value} sessions
      </p>
    </div>
  );
}

export function ActivityHeatmap({ hourCounts }: ActivityHeatmapProps) {
  const data = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourCounts[String(i)] || 0,
  }));

  return (
    <BentoCard>
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Activity by Hour</h3>
        <p className="text-xs text-gray-500">Session distribution across the day</p>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="hourBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ade80" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#4ade80" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="hour"
              tickFormatter={formatHour}
              stroke="rgba(255,255,255,0.2)"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              interval={2}
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fontSize: 12, fill: "rgba(255,255,255,0.4)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
              wrapperStyle={{ background: "none", border: "none", boxShadow: "none" }}
            />
            <Bar
              dataKey="count"
              fill="url(#hourBarGradient)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </BentoCard>
  );
}
