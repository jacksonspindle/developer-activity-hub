"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { BentoCard } from "@/components/bento-card";
import { cn } from "@/lib/utils";

interface YearHeatmapProps {
  title: string;
  subtitle: string;
  data: Map<string, number>;
  color: "green" | "blue";
  onDayClick?: (date: string) => void;
}

const GREEN_LEVELS = [
  "bg-white/[0.04]",
  "bg-green-900/70",
  "bg-green-700/80",
  "bg-green-500/80",
  "bg-green-400",
];

const BLUE_LEVELS = [
  "bg-white/[0.04]",
  "bg-blue-900/70",
  "bg-blue-700/80",
  "bg-blue-500/80",
  "bg-blue-400",
];

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function getIntensity(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

interface CellData {
  date: string;
  count: number; // -1 means out-of-year (hidden), 0+ means valid
  isFuture: boolean;
}

export function YearHeatmap({ title, subtitle, data, color, onDayClick }: YearHeatmapProps) {
  const [hovered, setHovered] = useState<{ date: string; count: number; isFuture: boolean; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(0);
  const levels = color === "green" ? GREEN_LEVELS : BLUE_LEVELS;

  const { grid, monthLabels, maxVal, numWeeks } = useMemo(() => {
    const year = new Date().getFullYear();
    const jan1 = new Date(year, 0, 1);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDay = new Date(jan1);
    startDay.setDate(startDay.getDate() - startDay.getDay());

    const dec31 = new Date(year, 11, 31);
    const endDay = new Date(dec31);
    endDay.setDate(endDay.getDate() + (6 - endDay.getDay()));

    let mx = 0;
    data.forEach((v) => { if (v > mx) mx = v; });

    const weeks: CellData[][] = [];
    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;
    const d = new Date(startDay);

    while (d <= endDay) {
      const week: CellData[] = [];
      for (let row = 0; row < 7; row++) {
        const dateStr = d.toLocaleDateString("en-CA");
        const outOfYear = d.getFullYear() !== year;
        const future = d > today && !outOfYear;
        const count = outOfYear ? -1 : (data.get(dateStr) || 0);

        week.push({ date: dateStr, count, isFuture: future });

        if (row === 0 && d.getMonth() !== lastMonth && d.getFullYear() === year) {
          lastMonth = d.getMonth();
          months.push({
            label: d.toLocaleDateString("en-US", { month: "short" }),
            col: weeks.length,
          });
        }

        d.setDate(d.getDate() + 1);
      }
      weeks.push(week);
    }

    return { grid: weeks, monthLabels: months, maxVal: mx, numWeeks: weeks.length };
  }, [data]);

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        const DAY_LABEL_WIDTH = 32;
        const gapSize = 2;
        const available = containerRef.current.offsetWidth - DAY_LABEL_WIDTH;
        const size = Math.floor((available - (numWeeks - 1) * gapSize) / numWeeks);
        setCellSize(Math.max(size, 8));
      }
    }
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [numWeeks]);

  const gap = 2;
  const dayLabelW = 32;

  if (cellSize === 0) {
    return (
      <BentoCard span={4} mobileSpan={2}>
        <div ref={containerRef} className="h-[180px]" />
      </BentoCard>
    );
  }

  return (
    <BentoCard span={4} mobileSpan={2}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div ref={containerRef}>
        {/* Month labels */}
        <div className="relative h-4 mb-1" style={{ marginLeft: `${dayLabelW}px` }}>
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-gray-500"
              style={{ left: `${m.col * (cellSize + gap)}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div className="flex" style={{ gap: `${gap}px` }}>
          {/* Day labels */}
          <div className="flex flex-col flex-shrink-0" style={{ gap: `${gap}px`, width: `${dayLabelW - 4}px` }}>
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="text-[10px] text-gray-500 flex items-center"
                style={{ height: `${cellSize}px` }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          {grid.map((week, colIdx) => (
            <div key={colIdx} className="flex flex-col" style={{ gap: `${gap}px` }}>
              {week.map((cell, rowIdx) => {
                // Out-of-year cells are hidden
                if (cell.count === -1) {
                  return (
                    <div
                      key={rowIdx}
                      style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
                    />
                  );
                }

                // Future days and past days both show as squares
                // Future = level 0 (faint), past = intensity based on count
                const intensity = cell.isFuture ? 0 : getIntensity(cell.count, maxVal);

                return (
                  <div
                    key={rowIdx}
                    className={cn(
                      "transition-colors rounded-[2px]",
                      levels[intensity],
                      !cell.isFuture && onDayClick && "cursor-pointer hover:ring-1 hover:ring-white/40"
                    )}
                    style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
                    onClick={() => {
                      if (!cell.isFuture && onDayClick) onDayClick(cell.date);
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHovered({
                        date: cell.date,
                        count: cell.count,
                        isFuture: cell.isFuture,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1 mt-3 text-[10px] text-gray-500">
          <span>Less</span>
          {levels.map((cls, i) => (
            <div key={i} className={cn("h-[10px] w-[10px] rounded-[2px]", cls)} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Tooltip via portal */}
      {hovered &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed rounded-xl border border-white/[0.12] bg-[#0c1220]/95 backdrop-blur-2xl px-2.5 py-1.5 shadow-2xl shadow-black/60 pointer-events-none"
            style={{
              left: hovered.x,
              top: hovered.y - 40,
              transform: "translateX(-50%)",
              zIndex: 99999,
            }}
          >
            <p className="text-[11px] text-gray-300 whitespace-nowrap">
              {hovered.isFuture ? (
                <span className="text-gray-500">
                  {new Date(hovered.date + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              ) : (
                <>
                  <span className={color === "green" ? "text-green-400 font-semibold" : "text-blue-400 font-semibold"}>
                    {hovered.count}
                  </span>
                  {" "}contribution{hovered.count !== 1 ? "s" : ""} on{" "}
                  {new Date(hovered.date + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </>
              )}
            </p>
          </div>,
          document.body
        )}
    </BentoCard>
  );
}
