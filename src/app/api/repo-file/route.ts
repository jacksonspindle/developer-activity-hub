import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get("repo");
  const filePath = request.nextUrl.searchParams.get("path");

  if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
    return NextResponse.json(
      { error: "Missing or invalid repo parameter" },
      { status: 400 }
    );
  }

  if (!filePath) {
    return NextResponse.json(
      { error: "Missing path parameter" },
      { status: 400 }
    );
  }

  try {
    const { stdout } = await execFileAsync(
      "gh",
      ["api", `/repos/${repo}/contents/${filePath}`],
      { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
    );

    const data = JSON.parse(stdout) as Record<string, unknown>;

    if (data.type !== "file") {
      return NextResponse.json(
        { error: "Path is not a file" },
        { status: 400 }
      );
    }

    const name = data.name as string;
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"];
    const isImage = imageExts.includes(ext);

    let content = "";
    if (!isImage && data.content) {
      content = Buffer.from(data.content as string, "base64").toString("utf-8");
    }

    return NextResponse.json({
      name,
      path: data.path as string,
      size: data.size as number,
      content,
      htmlUrl: data.html_url as string,
      downloadUrl: (data.download_url as string) || null,
      isImage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load file",
      },
      { status: 500 }
    );
  }
}
