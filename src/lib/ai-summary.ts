import Anthropic from "@anthropic-ai/sdk";
import type { ArchivedSession, GitHubDayActivity } from "./types";

const apiKey = process.env.ANTHROPIC_API_KEY;

export async function generateDaySummary(
  date: string,
  sessions: ArchivedSession[],
  github?: GitHubDayActivity
): Promise<string | null> {
  if (!apiKey || apiKey === "your-api-key-here") return null;
  if (sessions.length === 0 && !github) return null;

  const client = new Anthropic({ apiKey });

  // Build context about the day's sessions
  const sessionLines = sessions.map((s) => {
    const duration =
      s.durationMs > 0
        ? `${Math.round(s.durationMs / 60000)}min`
        : "unknown duration";
    const files =
      s.filesModified.length > 0
        ? `, files: ${s.filesModified.join(", ")}`
        : "";
    const task = s.taskDescription
      ? s.taskDescription.slice(0, 200)
      : "no description";
    return `- Project: ${s.project} | ${duration} | ${s.messageCount} messages | ${s.toolCallCount} tool calls${files}\n  Task: ${task}`;
  });

  // Build GitHub context if available
  let githubContext = "";
  if (github) {
    const parts: string[] = [];
    if (github.commits.length > 0) {
      parts.push(
        `Commits (${github.commits.length}):\n` +
          github.commits
            .map((c) => `  - ${c.repo}: ${c.message.split("\n")[0]}`)
            .join("\n")
      );
    }
    if (github.pullRequests.length > 0) {
      parts.push(
        `Pull Requests (${github.pullRequests.length}):\n` +
          github.pullRequests
            .map((pr) => `  - ${pr.repo}#${pr.number}: ${pr.title} (${pr.action})`)
            .join("\n")
      );
    }
    if (github.issues.length > 0) {
      parts.push(
        `Issues (${github.issues.length}):\n` +
          github.issues
            .map((i) => `  - ${i.repo}#${i.number}: ${i.title} (${i.action})`)
            .join("\n")
      );
    }
    if (parts.length > 0) {
      githubContext = `\n\nGitHub Activity:\n${parts.join("\n")}`;
    }
  }

  const prompt = `You are summarizing a developer's day of coding activity for ${date}. Write a brief, natural, conversational summary (2-4 sentences). Focus on what was accomplished, not raw stats. Mention specific projects and what was done in each. If there's GitHub activity, weave it in naturally.

Claude Code Sessions (${sessions.length}):
${sessionLines.join("\n")}${githubContext}

Write the summary in second person ("You worked on..."). Be specific about what was built or fixed. Keep it concise and informative.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0];
    if (text.type === "text") {
      return text.text.trim();
    }
    return null;
  } catch (err) {
    console.error("AI summary generation failed:", err);
    return null;
  }
}
