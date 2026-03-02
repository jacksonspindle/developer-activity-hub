import { NextRequest, NextResponse } from "next/server";
import { loadGitHubBulkStats } from "@/lib/github-bulk";

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const stats = await loadGitHubBulkStats(force);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("GitHub bulk stats failed:", err);
    return NextResponse.json(
      { error: "Failed to load GitHub stats" },
      { status: 500 }
    );
  }
}
