import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { StatsCache, DailyUsage, UsageData } from "./types";
import { utcToLocalDate } from "./utils";

interface JsonlEntry {
  type?: string;
  timestamp?: string;
  message?: {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

async function findJsonlFiles(baseDir: string, afterDate: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await findJsonlFiles(fullPath, afterDate);
        files.push(...subFiles);
      } else if (entry.name.endsWith(".jsonl")) {
        try {
          const stat = await fs.stat(fullPath);
          const fileDate = utcToLocalDate(stat.mtime.toISOString());
          if (fileDate > afterDate) {
            files.push(fullPath);
          }
        } catch {
          // skip files we can't stat
        }
      }
    }
  } catch {
    // skip directories we can't read
  }
  return files;
}

async function parseJsonlFile(filePath: string, afterDate: string): Promise<Map<string, { tokens: number; tokensByModel: Record<string, number> }>> {
  const dailyData = new Map<string, { tokens: number; tokensByModel: Record<string, number> }>();

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    // Streaming produces multiple lines for the same message ID with cumulative usage.
    // Collect the last (final) usage per message ID, keyed by "msgId".
    const messageUsage = new Map<string, { date: string; model: string; input: number; output: number }>();

    for (const line of lines) {
      try {
        const entry: JsonlEntry = JSON.parse(line);
        if (entry.type !== "assistant" || !entry.message?.usage || !entry.timestamp) continue;

        const date = utcToLocalDate(entry.timestamp);
        if (date <= afterDate) continue;

        const usage = entry.message.usage;
        const input = usage.input_tokens || 0;
        const output = usage.output_tokens || 0;
        if (input + output === 0) continue;

        const msgId = entry.message.id || `anon-${date}-${Math.random()}`;
        const model = entry.message.model || "unknown";

        // Overwrite — later lines for the same message have the final cumulative usage
        messageUsage.set(msgId, { date, model, input, output });
      } catch {
        // skip malformed lines
      }
    }

    // Aggregate deduplicated messages into daily buckets
    for (const { date, model, input, output } of messageUsage.values()) {
      const totalTokens = input + output;
      const existing = dailyData.get(date) || { tokens: 0, tokensByModel: {} };
      existing.tokens += totalTokens;
      existing.tokensByModel[model] = (existing.tokensByModel[model] || 0) + totalTokens;
      dailyData.set(date, existing);
    }
  } catch {
    // skip files we can't read
  }

  return dailyData;
}

export async function loadUsageData(): Promise<UsageData> {
  const homeDir = os.homedir();
  const statsPath = path.join(homeDir, ".claude", "stats-cache.json");

  let statsCache: StatsCache;
  try {
    const raw = await fs.readFile(statsPath, "utf-8");
    statsCache = JSON.parse(raw);
  } catch {
    throw new Error("Could not read ~/.claude/stats-cache.json");
  }

  // Build daily usage map from cached data
  const dailyMap = new Map<string, DailyUsage>();

  // Merge dailyActivity and dailyModelTokens
  for (const activity of statsCache.dailyActivity) {
    dailyMap.set(activity.date, {
      date: activity.date,
      tokens: 0,
      messages: activity.messageCount,
      sessions: activity.sessionCount,
      toolCalls: activity.toolCallCount,
      tokensByModel: {},
    });
  }

  for (const tokenDay of statsCache.dailyModelTokens) {
    const existing = dailyMap.get(tokenDay.date);
    const totalTokens = Object.values(tokenDay.tokensByModel).reduce((a, b) => a + b, 0);
    if (existing) {
      existing.tokens = totalTokens;
      existing.tokensByModel = tokenDay.tokensByModel;
    } else {
      dailyMap.set(tokenDay.date, {
        date: tokenDay.date,
        tokens: totalTokens,
        messages: 0,
        sessions: 0,
        toolCalls: 0,
        tokensByModel: tokenDay.tokensByModel,
      });
    }
  }

  // Supplement with recent JSONL files
  const projectsDir = path.join(homeDir, ".claude", "projects");
  try {
    const jsonlFiles = await findJsonlFiles(projectsDir, statsCache.lastComputedDate);

    for (const file of jsonlFiles) {
      const fileData = await parseJsonlFile(file, statsCache.lastComputedDate);
      for (const [date, data] of fileData) {
        const existing = dailyMap.get(date);
        if (existing) {
          existing.tokens += data.tokens;
          for (const [model, tokens] of Object.entries(data.tokensByModel)) {
            existing.tokensByModel[model] = (existing.tokensByModel[model] || 0) + tokens;
          }
        } else {
          dailyMap.set(date, {
            date,
            tokens: data.tokens,
            messages: 0,
            sessions: 0,
            toolCalls: 0,
            tokensByModel: data.tokensByModel,
          });
        }
      }
    }
  } catch {
    // JSONL supplementation is best-effort
  }

  // Sort by date
  const daily = Array.from(dailyMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  const totalTokens = daily.reduce((sum, d) => sum + d.tokens, 0);
  const totalMessages = statsCache.totalMessages;
  const totalSessions = statsCache.totalSessions;
  const totalToolCalls = daily.reduce((sum, d) => sum + d.toolCalls, 0);
  const daysActive = daily.length;

  return {
    daily,
    totalTokens,
    totalMessages,
    totalSessions,
    totalToolCalls,
    daysActive,
    modelUsage: statsCache.modelUsage,
    hourCounts: statsCache.hourCounts,
    firstSessionDate: statsCache.firstSessionDate,
  };
}
