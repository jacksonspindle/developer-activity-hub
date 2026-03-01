import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { ArchivedSession, SessionArchive } from "./types";
import { utcToLocalDate } from "./utils";

const DATA_DIR = path.join(process.cwd(), "data");
const ARCHIVE_PATH = path.join(DATA_DIR, "archive.json");

export async function getCachedDaySummary(date: string): Promise<string | null> {
  const archive = await loadArchive();
  return archive.daySummaries?.[date] ?? null;
}

export async function cacheDaySummary(date: string, summary: string): Promise<void> {
  const archive = await loadArchive();
  if (!archive.daySummaries) {
    archive.daySummaries = {};
  }
  archive.daySummaries[date] = summary;
  await saveArchive(archive);
}

interface JsonlEntry {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  message?: {
    id?: string;
    role?: string;
    model?: string;
    content?: string | Array<{ type: string; name?: string; text?: string; input?: Record<string, unknown> }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

export async function loadArchive(): Promise<SessionArchive> {
  try {
    const raw = await fs.readFile(ARCHIVE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { version: 2, lastScanAt: "", sessions: [] };
  }
}

async function saveArchive(archive: SessionArchive): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
}

function extractProjectName(projectDirName: string): string {
  const parts = projectDirName.split("-").filter(Boolean);
  return parts[parts.length - 1] || projectDirName;
}

function extractProjectPath(projectDirName: string): string {
  return "/" + projectDirName.split("-").filter(Boolean).join("/");
}

function extractSessionSummary(
  lines: string[],
  sessionId: string,
  projectDirName: string
): ArchivedSession | null {
  let firstTimestamp = 0;
  let lastTimestamp = 0;
  let date = "";
  let model = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let messageCount = 0;
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let taskDescription = "";
  const toolCallSet = new Set<string>();
  let toolCallCount = 0;
  const filesModified = new Set<string>();

  const messageUsage = new Map<string, {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  }>();

  for (const line of lines) {
    try {
      const entry: JsonlEntry = JSON.parse(line);

      if (!entry.type && !entry.message) continue;

      if (entry.timestamp) {
        const ts = new Date(entry.timestamp).getTime();
        if (!firstTimestamp) {
          firstTimestamp = ts;
          date = utcToLocalDate(entry.timestamp);
        }
        lastTimestamp = ts;
      }

      if (entry.sessionId && entry.sessionId !== sessionId) continue;

      const msg = entry.message;
      if (!msg) continue;

      // Extract task description from first substantive user message (full text, no truncation)
      if (msg.role === "user" && !taskDescription) {
        let text = "";
        if (typeof msg.content === "string") {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === "text" && block.text) {
              text = block.text;
              break;
            }
          }
        }
        if (text && !text.startsWith("[Request interrupted") && text.length > 5) {
          taskDescription = text.slice(0, 1000);
        }
      }

      // Count messages by role
      if (msg.role === "user") {
        messageCount++;
        userMessageCount++;
      } else if (msg.role === "assistant") {
        messageCount++;
        assistantMessageCount++;
      }

      if (msg.model && !model) {
        model = msg.model;
      }

      // Track tool calls and extract file paths from Write/Edit
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "tool_use" && block.name) {
            toolCallSet.add(block.name);
            toolCallCount++;

            if ((block.name === "Write" || block.name === "Edit") && block.input) {
              const fp = block.input.file_path;
              if (typeof fp === "string") {
                // Store just the filename for brevity
                filesModified.add(path.basename(fp));
              }
            }
          }
        }
      }

      // Track token usage (deduplicated by message ID)
      if (msg.role === "assistant" && msg.usage && msg.id) {
        const input = msg.usage.input_tokens || 0;
        const output = msg.usage.output_tokens || 0;
        const cacheRead = msg.usage.cache_read_input_tokens || 0;
        const cacheCreation = msg.usage.cache_creation_input_tokens || 0;
        if (input + output > 0) {
          messageUsage.set(msg.id, { input, output, cacheRead, cacheCreation });
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  if (!date || messageCount === 0) return null;

  for (const { input, output, cacheRead, cacheCreation } of messageUsage.values()) {
    inputTokens += input;
    outputTokens += output;
    cacheReadTokens += cacheRead;
    cacheCreationTokens += cacheCreation;
  }

  const durationMs = lastTimestamp > firstTimestamp ? lastTimestamp - firstTimestamp : 0;

  return {
    sessionId,
    date,
    project: extractProjectName(projectDirName),
    projectPath: extractProjectPath(projectDirName),
    taskDescription,
    totalTokens: inputTokens + outputTokens,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    toolCalls: Array.from(toolCallSet).sort(),
    toolCallCount,
    model: model || "unknown",
    messageCount,
    userMessageCount,
    assistantMessageCount,
    durationMs,
    filesModified: Array.from(filesModified).sort(),
    timestamp: firstTimestamp,
  };
}

async function findAllJsonlFiles(
  projectsDir: string
): Promise<Array<{ filePath: string; sessionId: string; projectDir: string }>> {
  const results: Array<{ filePath: string; sessionId: string; projectDir: string }> = [];

  try {
    const projectDirs = await fs.readdir(projectsDir, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const projectPath = path.join(projectsDir, dir.name);
      try {
        const entries = await fs.readdir(projectPath);
        for (const entry of entries) {
          if (!entry.endsWith(".jsonl")) continue;
          const sessionId = entry.replace(".jsonl", "");
          const filePath = path.join(projectPath, entry);
          results.push({ filePath, sessionId, projectDir: dir.name });
        }
      } catch {
        // skip unreadable directories
      }
    }
  } catch {
    // projects dir doesn't exist
  }

  return results;
}

export async function updateArchive(): Promise<SessionArchive> {
  const archive = await loadArchive();

  // Force re-scan if archive version is outdated
  const needsRescan = archive.version < 2;
  if (needsRescan) {
    archive.sessions = [];
    archive.version = 2;
  }

  const existingIds = new Set(archive.sessions.map((s) => s.sessionId));

  const homeDir = os.homedir();
  const projectsDir = path.join(homeDir, ".claude", "projects");

  const allFiles = await findAllJsonlFiles(projectsDir);

  let newSessions = 0;
  for (const { filePath, sessionId, projectDir } of allFiles) {
    if (existingIds.has(sessionId)) continue;

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n").filter(Boolean);

      const summary = extractSessionSummary(lines, sessionId, projectDir);
      if (summary) {
        archive.sessions.push(summary);
        existingIds.add(sessionId);
        newSessions++;
      }
    } catch {
      // skip unreadable files
    }
  }

  if (newSessions > 0 || !archive.lastScanAt || needsRescan) {
    archive.lastScanAt = new Date().toISOString();
    await saveArchive(archive);
  }

  return archive;
}
