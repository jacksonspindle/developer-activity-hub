"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatFullDate, formatNumber } from "@/lib/utils";
import type { DailyUsage } from "@/lib/types";

interface UsageChartProps {
  data: DailyUsage[];
  onDayClick?: (date: string) => void;
}

function CustomTooltip({
  active,
  payload,
  label,
  clickable,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  clickable?: boolean;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#161b22] px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400">{formatFullDate(label)}</p>
      <p className="text-sm font-semibold text-green-400">
        {formatNumber(payload[0].value)} tokens
      </p>
      {clickable && (
        <p className="mt-1 text-[10px] text-gray-500">Click for details</p>
      )}
    </div>
  );
}

export function UsageChart({ data, onDayClick }: UsageChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDotClick = (_event: any, payload: any) => {
    if (payload?.payload?.date && onDayClick) {
      onDayClick(payload.payload.date);
    }
  };

  return (
    <Card className="border-white/5 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="text-lg">Daily Token Usage</CardTitle>
        {onDayClick && (
          <p className="text-xs text-gray-500">Click any data point to see session details</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="rgba(255,255,255,0.3)"
                tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis
                tickFormatter={formatNumber}
                stroke="rgba(255,255,255,0.3)"
                tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <Tooltip content={<CustomTooltip clickable={!!onDayClick} />} />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#4ade80"
                strokeWidth={2}
                fill="url(#tokenGradient)"
                dot={{ r: 3, fill: "#4ade80", stroke: "#4ade80" }}
                activeDot={{
                  r: 7,
                  fill: "#4ade80",
                  stroke: "#22c55e",
                  strokeWidth: 2,
                  cursor: onDayClick ? "pointer" : "default",
                  onClick: onDayClick ? handleDotClick : undefined,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
