import { NextRequest, NextResponse } from "next/server";
import { loadArchive, getCachedDaySummary, cacheDaySummary } from "@/lib/archive";
import { loadUsageData } from "@/lib/parse-stats";
import { generateDaySummary } from "@/lib/ai-summary";
import { getGitHubActivity } from "@/lib/github";
import type { DayDetailResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Missing or invalid date parameter (expected YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    // Fetch archive, usage data, and GitHub activity in parallel
    const [archive, usageData, github] = await Promise.all([
      loadArchive(),
      loadUsageData(),
      getGitHubActivity(date).catch(() => null),
    ]);

    // Get archived sessions for this date
    const sessions = archive.sessions
      .filter((s) => s.date === date)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Get aggregate stats from the usage data for this day
    const dayUsage = usageData.daily.find((d) => d.date === date);

    // AI summary: check cache first, generate if missing
    let daySummary = await getCachedDaySummary(date);
    if (!daySummary && (sessions.length > 0 || github)) {
      const generated = await generateDaySummary(date, sessions, github ?? undefined);
      if (generated) {
        daySummary = generated;
        // Cache in background — don't block response
        cacheDaySummary(date, generated).catch(() => {});
      }
    }

    const response: DayDetailResponse = {
      date,
      totalTokens: dayUsage?.tokens ?? sessions.reduce((sum, s) => sum + s.totalTokens, 0),
      totalSessions: dayUsage?.sessions ?? sessions.length,
      totalMessages: dayUsage?.messages ?? sessions.reduce((sum, s) => sum + s.messageCount, 0),
      totalToolCalls: dayUsage?.toolCalls ?? sessions.reduce((sum, s) => sum + s.toolCallCount, 0),
      sessions,
      hasSessionData: sessions.length > 0,
      daySummary: daySummary ?? undefined,
      github: github ?? undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load day detail" },
      { status: 500 }
    );
  }
}
