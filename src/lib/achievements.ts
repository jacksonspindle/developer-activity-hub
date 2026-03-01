import type {
  StreakData,
  StreakInfo,
  Achievement,
  GitHubDailyAggregate,
} from "./github-types";

function emptyStreak(): StreakInfo {
  return { days: 0, start: "", end: "" };
}

export function calculateStreaks(
  claudeDaily: { date: string; tokens: number }[],
  githubDaily: GitHubDailyAggregate[],
  today: string
): StreakData {
  // Build sets of active dates
  const githubActiveDates = new Set<string>();
  for (const d of githubDaily) {
    if (d.commits + d.prsOpened + d.issuesCreated > 0) {
      githubActiveDates.add(d.date);
    }
  }

  const claudeActiveDates = new Set<string>();
  for (const d of claudeDaily) {
    if (d.tokens > 0) {
      claudeActiveDates.add(d.date);
    }
  }

  const combinedActiveDates = new Set<string>([
    ...githubActiveDates,
    ...claudeActiveDates,
  ]);

  function computeStreak(
    activeDates: Set<string>,
    fromDate: string
  ): { current: StreakInfo; longest: StreakInfo } {
    // Walk backwards from fromDate
    let currentDays = 0;
    let currentEnd = "";
    let currentStart = "";

    const d = new Date(fromDate + "T12:00:00");
    while (true) {
      const dateStr = d.toLocaleDateString("en-CA");
      if (activeDates.has(dateStr)) {
        currentDays++;
        if (!currentEnd) currentEnd = dateStr;
        currentStart = dateStr;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }

    const current: StreakInfo = currentDays > 0
      ? { days: currentDays, start: currentStart, end: currentEnd }
      : emptyStreak();

    // Find longest streak: collect all dates, sort, walk
    const sortedDates = Array.from(activeDates).sort();
    let longest: StreakInfo = emptyStreak();
    let runStart = "";
    let runLength = 0;
    let prev = "";

    for (const date of sortedDates) {
      if (prev) {
        const prevDate = new Date(prev + "T12:00:00");
        prevDate.setDate(prevDate.getDate() + 1);
        const nextExpected = prevDate.toLocaleDateString("en-CA");
        if (date === nextExpected) {
          runLength++;
        } else {
          if (runLength > longest.days) {
            longest = { days: runLength, start: runStart, end: prev };
          }
          runStart = date;
          runLength = 1;
        }
      } else {
        runStart = date;
        runLength = 1;
      }
      prev = date;
    }
    if (runLength > longest.days) {
      longest = { days: runLength, start: runStart, end: prev };
    }

    return { current, longest };
  }

  const github = computeStreak(githubActiveDates, today);
  const combined = computeStreak(combinedActiveDates, today);

  return {
    current: github.current,
    longest: github.longest,
    currentCombined: combined.current,
    longestCombined: combined.longest,
  };
}

export function computeAchievements(
  totals: {
    commits: number;
    prsOpened: number;
    prsMerged: number;
    prsReviewed: number;
    issuesCreated: number;
  },
  streaks: StreakData,
  claudeDaily: { date: string; tokens: number }[],
  githubDaily: GitHubDailyAggregate[]
): Achievement[] {
  const now = new Date().toISOString();

  const totalTokens = claudeDaily.reduce((sum, d) => sum + d.tokens, 0);
  const languages = new Set<string>(); // computed from repos, but we don't have them here
  const maxCommitsInDay = githubDaily.reduce((max, d) => Math.max(max, d.commits), 0);

  // Check for night owl: any activity in hours — we don't have hour data here,
  // so we'll check if there are any Claude sessions data we can use
  // For now, mark as locked without progress

  const definitions: {
    id: string;
    title: string;
    description: string;
    icon: string;
    check: () => boolean;
    progress?: { current: number; target: number };
  }[] = [
    {
      id: "first-blood",
      title: "First Blood",
      description: "Make your first commit",
      icon: "🎯",
      check: () => totals.commits >= 1,
      progress: { current: Math.min(totals.commits, 1), target: 1 },
    },
    {
      id: "century-club",
      title: "Century Club",
      description: "Reach 100 commits in 90 days",
      icon: "💯",
      check: () => totals.commits >= 100,
      progress: { current: Math.min(totals.commits, 100), target: 100 },
    },
    {
      id: "on-fire",
      title: "On Fire",
      description: "Maintain a 7-day streak",
      icon: "🔥",
      check: () => streaks.longestCombined.days >= 7,
      progress: {
        current: Math.min(streaks.currentCombined.days, 7),
        target: 7,
      },
    },
    {
      id: "unstoppable",
      title: "Unstoppable",
      description: "Maintain a 30-day streak",
      icon: "⚡",
      check: () => streaks.longestCombined.days >= 30,
      progress: {
        current: Math.min(streaks.currentCombined.days, 30),
        target: 30,
      },
    },
    {
      id: "pr-machine",
      title: "PR Machine",
      description: "Open 10 pull requests",
      icon: "🚀",
      check: () => totals.prsOpened >= 10,
      progress: { current: Math.min(totals.prsOpened, 10), target: 10 },
    },
    {
      id: "code-reviewer",
      title: "Code Reviewer",
      description: "Review 10 pull requests",
      icon: "👀",
      check: () => totals.prsReviewed >= 10,
      progress: { current: Math.min(totals.prsReviewed, 10), target: 10 },
    },
    {
      id: "token-millionaire",
      title: "Token Millionaire",
      description: "Use 1 million Claude tokens",
      icon: "💰",
      check: () => totalTokens >= 1_000_000,
      progress: {
        current: Math.min(totalTokens, 1_000_000),
        target: 1_000_000,
      },
    },
    {
      id: "polyglot",
      title: "Polyglot",
      description: "Work in 3+ programming languages",
      icon: "🌍",
      check: () => languages.size >= 3,
      progress: { current: languages.size, target: 3 },
    },
    {
      id: "night-owl",
      title: "Night Owl",
      description: "Code after midnight",
      icon: "🦉",
      check: () => false, // Requires hour-level data
    },
    {
      id: "power-day",
      title: "Power Day",
      description: "Make 10+ commits in a single day",
      icon: "💪",
      check: () => maxCommitsInDay >= 10,
      progress: { current: Math.min(maxCommitsInDay, 10), target: 10 },
    },
  ];

  return definitions.map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    icon: def.icon,
    unlockedAt: def.check() ? now : null,
    progress: def.progress,
  }));
}
