import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

export function formatDate(dateString: string): string {
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatFullDate(dateString: string): string {
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getModelDisplayName(modelId: string): string {
  if (modelId.includes("opus-4-6")) return "Opus 4.6";
  if (modelId.includes("opus-4-5")) return "Opus 4.5";
  if (modelId.includes("sonnet-4-6")) return "Sonnet 4.6";
  if (modelId.includes("sonnet-4-5")) return "Sonnet 4.5";
  if (modelId.includes("haiku-4-5")) return "Haiku 4.5";
  return modelId;
}

export function getModelColor(modelId: string): string {
  if (modelId.includes("opus-4-6")) return "#4ade80";
  if (modelId.includes("opus-4-5")) return "#22d3ee";
  if (modelId.includes("sonnet-4-6")) return "#a78bfa";
  if (modelId.includes("sonnet-4-5")) return "#f472b6";
  if (modelId.includes("haiku")) return "#fbbf24";
  return "#94a3b8";
}

export function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

/** Convert a UTC ISO timestamp to a local-timezone YYYY-MM-DD string */
export function utcToLocalDate(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString("en-CA"); // en-CA gives YYYY-MM-DD
}

export const DATA_COLORS = {
  claude: "#4ade80",
  commits: "#60a5fa",
  pullRequests: "#c084fc",
  issues: "#fb923c",
  reviews: "#22d3ee",
  streaks: "#fbbf24",
} as const;
