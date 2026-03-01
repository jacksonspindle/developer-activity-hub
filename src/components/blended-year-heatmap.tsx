"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { BentoCard } from "@/components/bento-card";

interface BlendedYearHeatmapProps {
  claudeData: Map<string, number>;
  githubData: Map<string, number>;
  onDayClick?: (date: string) => void;
}

// Green (Claude): rgb(74, 222, 128)
// Blue (GitHub):  rgb(96, 165, 250)
const GREEN = { r: 74, g: 222, b: 128 };
const BLUE = { r: 96, g: 165, b: 250 };

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

// Intensity multipliers for 5 levels (0 = empty, 1-4 = increasing brightness)
const INTENSITY = [0, 0.3, 0.5, 0.75, 1.0];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function blendColor(
  claudeRatio: number, // 0 = all GitHub, 1 = all Claude
  intensity: number    // 0-4
): string {
  if (intensity === 0) return "rgba(255,255,255,0.04)";

  const mult = INTENSITY[intensity];
  // Interpolate hue between green and blue
  const r = lerp(BLUE.r, GREEN.r, claudeRatio);
  const g = lerp(BLUE.g, GREEN.g, claudeRatio);
  const b = lerp(BLUE.b, GREEN.b, claudeRatio);

  // Apply intensity as alpha
  const alpha = 0.15 + mult * 0.85;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getIntensity(total: number, max: number): number {
  if (total === 0) return 0;
  if (max <= 0) return 1;
  const ratio = total / max;
  if (ratio <= 0.2) return 1;
  if (ratio <= 0.45) return 2;
  if (ratio <= 0.7) return 3;
  return 4;
}

interface CellData {
  date: string;
  claude: number;
  github: number;
  total: number;
  ratio: number;  // 0 = all GitHub, 1 = all Claude, 0.5 = even mix
  hidden: boolean; // out-of-year
  isFuture: boolean;
}

export function BlendedYearHeatmap({ claudeData, githubData, onDayClick }: BlendedYearHeatmapProps) {
  const [hovered, setHovered] = useState<{
    cell: CellData;
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(0);

  const { grid, monthLabels, maxTotal, numWeeks } = useMemo(() => {
    const year = new Date().getFullYear();
    const jan1 = new Date(year, 0, 1);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDay = new Date(jan1);
    startDay.setDate(startDay.getDate() - startDay.getDay());

    const dec31 = new Date(year, 11, 31);
    const endDay = new Date(dec31);
    endDay.setDate(endDay.getDate() + (6 - endDay.getDay()));

    // Find max for normalization
    let maxC = 0;
    let maxG = 0;
    claudeData.forEach((v) => { if (v > maxC) maxC = v; });
    githubData.forEach((v) => { if (v > maxG) maxG = v; });

    let maxT = 0;

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

        const claude = claudeData.get(dateStr) || 0;
        const github = githubData.get(dateStr) || 0;

        // Normalize each to 0-1 scale then compute ratio
        const cNorm = maxC > 0 ? claude / maxC : 0;
        const gNorm = maxG > 0 ? github / maxG : 0;
        const sum = cNorm + gNorm;
        const ratio = sum > 0 ? cNorm / sum : 0.5; // 1 = all Claude, 0 = all GitHub

        // Total for intensity (use normalized sum)
        const total = cNorm + gNorm;
        if (total > maxT) maxT = total;

        week.push({
          date: dateStr,
          claude,
          github,
          total,
          ratio,
          hidden: outOfYear,
          isFuture: future,
        });

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

    return { grid: weeks, monthLabels: months, maxTotal: maxT, numWeeks: weeks.length };
  }, [claudeData, githubData]);

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
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Combined Activity</h3>
          <p className="text-xs text-gray-500">Color blend — green is Claude, blue is GitHub</p>
        </div>
        {/* Color legend */}
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="text-green-400">Claude</span>
          <div className="flex gap-[1px]">
            {[1, 0.8, 0.6, 0.4, 0.2, 0].map((ratio, i) => (
              <div
                key={i}
                className="h-3 w-5 rounded-[2px]"
                style={{ backgroundColor: blendColor(ratio, 4) }}
              />
            ))}
          </div>
          <span className="text-blue-400">GitHub</span>
        </div>
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
                if (cell.hidden) {
                  return (
                    <div
                      key={rowIdx}
                      style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
                    />
                  );
                }

                const intensity = cell.isFuture
                  ? 0
                  : getIntensity(cell.total, maxTotal);

                const bgColor = blendColor(cell.ratio, intensity);

                return (
                  <div
                    key={rowIdx}
                    className="transition-colors rounded-[2px]"
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      backgroundColor: bgColor,
                      cursor: !cell.isFuture && onDayClick ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (!cell.isFuture && onDayClick) onDayClick(cell.date);
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHovered({
                        cell,
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

        {/* Intensity legend */}
        <div className="flex items-center gap-1 mt-3 text-[10px] text-gray-500">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[10px] w-[10px] rounded-[2px]"
              style={{ backgroundColor: blendColor(0.5, i) }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Tooltip via portal */}
      {hovered &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed rounded-xl border border-white/[0.12] bg-[#0c1220]/95 backdrop-blur-2xl px-3 py-2 shadow-2xl shadow-black/60 pointer-events-none"
            style={{
              left: hovered.x,
              top: hovered.y - 8,
              transform: "translate(-50%, -100%)",
              zIndex: 99999,
            }}
          >
            {hovered.cell.isFuture ? (
              <p className="text-[11px] text-gray-500">
                {new Date(hovered.cell.date + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            ) : (
              <div>
                <p className="text-[11px] text-gray-300 mb-1">
                  {new Date(hovered.cell.date + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                {hovered.cell.claude > 0 && (
                  <p className="text-[10px]">
                    <span className="text-green-400 font-medium">Claude:</span>{" "}
                    <span className="text-gray-400">{hovered.cell.claude} activity</span>
                  </p>
                )}
                {hovered.cell.github > 0 && (
                  <p className="text-[10px]">
                    <span className="text-blue-400 font-medium">GitHub:</span>{" "}
                    <span className="text-gray-400">{hovered.cell.github} contributions</span>
                  </p>
                )}
                {hovered.cell.claude === 0 && hovered.cell.github === 0 && (
                  <p className="text-[10px] text-gray-500">No activity</p>
                )}
                {(hovered.cell.claude > 0 || hovered.cell.github > 0) && (
                  <div className="flex items-center gap-1 mt-1">
                    <div
                      className="h-2 w-12 rounded-full overflow-hidden flex"
                    >
                      <div
                        style={{
                          width: `${hovered.cell.ratio * 100}%`,
                          backgroundColor: `rgb(${GREEN.r},${GREEN.g},${GREEN.b})`,
                        }}
                        className="h-full"
                      />
                      <div
                        style={{
                          width: `${(1 - hovered.cell.ratio) * 100}%`,
                          backgroundColor: `rgb(${BLUE.r},${BLUE.g},${BLUE.b})`,
                        }}
                        className="h-full"
                      />
                    </div>
                    <span className="text-[9px] text-gray-500">
                      {Math.round(hovered.cell.ratio * 100)}% / {Math.round((1 - hovered.cell.ratio) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </BentoCard>
  );
}
