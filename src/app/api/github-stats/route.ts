import { NextResponse } from "next/server";
import { loadGitHubBulkStats } from "@/lib/github-bulk";

export async function GET() {
  try {
    const stats = await loadGitHubBulkStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("GitHub bulk stats failed:", err);
    return NextResponse.json(
      { error: "Failed to load GitHub stats" },
      { status: 500 }
    );
  }
}
