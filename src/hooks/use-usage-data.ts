"use client";

import { useState, useEffect, useCallback } from "react";
import type { UsageData } from "@/lib/types";

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function useUsageData() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch("/api/usage")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch usage data");
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
    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(), [fetchData]);

  return { data, loading, error, refresh };
}
