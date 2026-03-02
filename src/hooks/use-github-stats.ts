"use client";

import { useState, useEffect, useCallback } from "react";
import type { GitHubBulkStats } from "@/lib/github-types";

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function useGitHubStats() {
  const [data, setData] = useState<GitHubBulkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback((force = false) => {
    const url = force ? "/api/github-stats?force=1" : "/api/github-stats";
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch GitHub stats");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, error, refresh };
}
