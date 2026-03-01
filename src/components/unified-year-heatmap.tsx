"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { BentoCard } from "@/components/bento-card";
import { cn } from "@/lib/utils";

type HeatmapMode = "claude" | "github" | "combined";

interface UnifiedYearHeatmapProps {
  claudeData: Map<string, number>;
  githubData: Map<string, number>;
  onDayClick?: (date: string) => void;
}

// Green (Claude): rgb(74, 222, 128)
// Blue (GitHub):  rgb(96, 165, 250)
const GREEN = { r: 74, g: 222, b: 128 };
const BLUE = { r: 96, g: 165, b: 250 };

const GREEN_LEVELS = [
  "rgba(255,255,255,0.04)",
  "rgba(22,101,52,0.7)",
  "rgba(21,128,61,0.8)",
  "rgba(34,197,94,0.8)",
  "rgba(74,222,128,1)",
];

const BLUE_LEVELS = [
  "rgba(255,255,255,0.04)",
  "rgba(30,58,138,0.7)",
  "rgba(29,78,216,0.8)",
  "rgba(59,130,246,0.8)",
  "rgba(96,165,250,1)",
];

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

const INTENSITY_MULTS = [0, 0.3, 0.5, 0.75, 1.0];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function blendColor(claudeRatio: number, intensity: number): string {
  if (intensity === 0) return "rgba(255,255,255,0.04)";
  const mult = INTENSITY_MULTS[intensity];
  const r = lerp(BLUE.r, GREEN.r, claudeRatio);
  const g = lerp(BLUE.g, GREEN.g, claudeRatio);
  const b = lerp(BLUE.b, GREEN.b, claudeRatio);
  const alpha = 0.15 + mult * 0.85;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getIntensity(value: number, max: number): number {
  if (value === 0) return 0;
  if (max <= 0) return 1;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

interface CellData {
  date: string;
  claude: number;
  github: number;
  hidden: boolean;
  isFuture: boolean;
}

const MODE_BUTTONS: { key: HeatmapMode; label: string; color: string; activeClass: string }[] = [
  { key: "claude", label: "Claude", color: "text-green-400", activeClass: "border-green-500/30 bg-green-500/10 text-green-400" },
  { key: "github", label: "GitHub", color: "text-blue-400", activeClass: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  { key: "combined", label: "Combined", color: "text-purple-400", activeClass: "border-purple-500/30 bg-purple-500/10 text-purple-400" },
];

export function UnifiedYearHeatmap({ claudeData, githubData, onDayClick }: UnifiedYearHeatmapProps) {
  const [mode, setMode] = useState<HeatmapMode>("combined");
  const [hovered, setHovered] = useState<{ cell: CellData; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(0);

  const { grid, monthLabels, maxClaude, maxGithub, maxBlended, numWeeks } = useMemo(() => {
    const year = new Date().getFullYear();
    const jan1 = new Date(year, 0, 1);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDay = new Date(jan1);
    startDay.setDate(startDay.getDate() - startDay.getDay());

    const dec31 = new Date(year, 11, 31);
    const endDay = new Date(dec31);
    endDay.setDate(endDay.getDate() + (6 - endDay.getDay()));

    let mxC = 0;
    let mxG = 0;
    claudeData.forEach((v) => { if (v > mxC) mxC = v; });
    githubData.forEach((v) => { if (v > mxG) mxG = v; });

    let mxB = 0;

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

        // Track max blended (normalized sum)
        const cNorm = mxC > 0 ? claude / mxC : 0;
        const gNorm = mxG > 0 ? github / mxG : 0;
        const blendedTotal = cNorm + gNorm;
        if (blendedTotal > mxB) mxB = blendedTotal;

        week.push({ date: dateStr, claude, github, hidden: outOfYear, isFuture: future });

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

    return { grid: weeks, monthLabels: months, maxClaude: mxC, maxGithub: mxG, maxBlended: mxB, numWeeks: weeks.length };
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

  function getCellColor(cell: CellData): string {
    if (cell.isFuture || cell.hidden) return "rgba(255,255,255,0.04)";

    if (mode === "claude") {
      const intensity = getIntensity(cell.claude, maxClaude);
      return GREEN_LEVELS[intensity];
    }
    if (mode === "github") {
      const intensity = getIntensity(cell.github, maxGithub);
      return BLUE_LEVELS[intensity];
    }
    // combined
    const cNorm = maxClaude > 0 ? cell.claude / maxClaude : 0;
    const gNorm = maxGithub > 0 ? cell.github / maxGithub : 0;
    const sum = cNorm + gNorm;
    const ratio = sum > 0 ? cNorm / sum : 0.5;
    const intensity = getIntensity(sum, maxBlended);
    return blendColor(ratio, intensity);
  }

  const gap = 2;
  const dayLabelW = 32;

  if (cellSize === 0) {
    return (
      <BentoCard span={4} mobileSpan={2}>
        <div ref={containerRef} className="h-[180px]" />
      </BentoCard>
    );
  }

  // Build legend
  const legend = (() => {
    if (mode === "claude") {
      return (
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <span>Less</span>
          {GREEN_LEVELS.map((bg, i) => (
            <div key={i} className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: bg }} />
          ))}
          <span>More</span>
        </div>
      );
    }
    if (mode === "github") {
      return (
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <span>Less</span>
          {BLUE_LEVELS.map((bg, i) => (
            <div key={i} className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: bg }} />
          ))}
          <span>More</span>
        </div>
      );
    }
    // combined legend: gradient bar + intensity
    return (
      <div className="flex items-center gap-3 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: blendColor(0.5, i) }} />
          ))}
          <span>More</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-green-400">Claude</span>
          <div className="flex gap-[1px]">
            {[1, 0.75, 0.5, 0.25, 0].map((ratio, i) => (
              <div key={i} className="h-[10px] w-3 rounded-[1px]" style={{ backgroundColor: blendColor(ratio, 4) }} />
            ))}
          </div>
          <span className="text-blue-400">GitHub</span>
        </div>
      </div>
    );
  })();

  const subtitle = mode === "claude"
    ? "Token usage this year"
    : mode === "github"
    ? "Commits, PRs & issues this year"
    : "Color blend — green is Claude, blue is GitHub";

  return (
    <BentoCard span={4} mobileSpan={2}>
      <div className="mb-4 flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Year Heatmap</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          {MODE_BUTTONS.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setMode(btn.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all border",
                mode === btn.key
                  ? btn.activeClass
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              {btn.label}
            </button>
          ))}
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

                const bgColor = getCellColor(cell);

                return (
                  <div
                    key={rowIdx}
                    className={cn(
                      "transition-colors rounded-[2px]",
                      !cell.isFuture && onDayClick && "cursor-pointer hover:ring-1 hover:ring-white/40"
                    )}
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      backgroundColor: bgColor,
                    }}
                    onClick={() => {
                      if (!cell.isFuture && onDayClick) onDayClick(cell.date);
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHovered({ cell, x: rect.left + rect.width / 2, y: rect.top });
                    }}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3">{legend}</div>
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
                {(hovered.cell.claude > 0 || hovered.cell.github > 0) && mode === "combined" && (
                  (() => {
                    const cNorm = maxClaude > 0 ? hovered.cell.claude / maxClaude : 0;
                    const gNorm = maxGithub > 0 ? hovered.cell.github / maxGithub : 0;
                    const sum = cNorm + gNorm;
                    const ratio = sum > 0 ? cNorm / sum : 0.5;
                    return (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="h-2 w-12 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${ratio * 100}%`, backgroundColor: `rgb(${GREEN.r},${GREEN.g},${GREEN.b})` }}
                            className="h-full"
                          />
                          <div
                            style={{ width: `${(1 - ratio) * 100}%`, backgroundColor: `rgb(${BLUE.r},${BLUE.g},${BLUE.b})` }}
                            className="h-full"
                          />
                        </div>
                        <span className="text-[9px] text-gray-500">
                          {Math.round(ratio * 100)}% / {Math.round((1 - ratio) * 100)}%
                        </span>
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </BentoCard>
  );
}
