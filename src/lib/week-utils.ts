import type { WeekIdentifier } from "./weekly-types";

/** ISO 8601 week number (Thursday-based algorithm) */
export function getISOWeek(date: Date): { isoYear: number; isoWeek: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear: d.getUTCFullYear(), isoWeek: weekNo };
}

/** Convert a date to ISO week string, e.g. "2026-W09" */
export function toISOWeekString(date: Date): string {
  const { isoYear, isoWeek } = getISOWeek(date);
  return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
}

/** Parse "2026-W09" → Monday and Sunday dates of that week */
export function parseISOWeekString(weekStr: string): { monday: Date; sunday: Date } {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid week string: ${weekStr}`);
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Jan 4 always belongs to week 1 of its ISO year
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Mon=1..Sun=7
  // Monday of week 1
  const week1Monday = new Date(Date.UTC(year, 0, 4 - jan4Day + 1));
  // Monday of the target week
  const monday = new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);

  return { monday, sunday };
}

/** Get 7 YYYY-MM-DD strings (Mon-Sun) for a given week string */
export function getWeekDates(weekStr: string): string[] {
  const { monday } = parseISOWeekString(weekStr);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 86400000);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

/** Build a full WeekIdentifier from a week string */
export function buildWeekIdentifier(weekStr: string): WeekIdentifier {
  const dates = getWeekDates(weekStr);
  const start = dates[0];
  const end = dates[6];

  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const yearStr = endDate.getFullYear().toString();

  const label =
    startDate.getMonth() === endDate.getMonth()
      ? `${fmt(startDate)} – ${endDate.getDate()}, ${yearStr}`
      : `${fmt(startDate)} – ${fmt(endDate)}, ${yearStr}`;

  return { week: weekStr, start, end, label };
}

/** Get the current ISO week string */
export function getCurrentWeekString(): string {
  return toISOWeekString(new Date());
}

/** Shift a week string by `delta` weeks (+1 = next, -1 = previous) */
export function offsetWeek(weekStr: string, delta: number): string {
  const { monday } = parseISOWeekString(weekStr);
  const shifted = new Date(monday.getTime() + delta * 7 * 86400000);
  return toISOWeekString(shifted);
}
