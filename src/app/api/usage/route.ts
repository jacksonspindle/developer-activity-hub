import { NextResponse } from "next/server";
import { loadUsageData } from "@/lib/parse-stats";
import { updateArchive } from "@/lib/archive";

export async function GET() {
  try {
    // Update archive with any new sessions (fast — skips already-archived)
    await updateArchive();

    const data = await loadUsageData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load usage data" },
      { status: 500 }
    );
  }
}
