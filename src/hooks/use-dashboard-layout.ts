"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CARD_CONFIGS,
  DEFAULT_CARD_ORDER,
  DEFAULT_CARD_SPANS,
} from "@/lib/dashboard-cards";

const STORAGE_KEY = "dashboard-layout-v1";

interface DashboardLayout {
  cardOrder: string[];
  cardSpans: Record<string, number>;
}

function validateLayout(stored: DashboardLayout): DashboardLayout {
  const validIds = new Set(CARD_CONFIGS.map((c) => c.id));

  // Filter out any stored IDs that no longer exist
  const order = stored.cardOrder.filter((id) => validIds.has(id));

  // Add any new cards that weren't in the stored layout
  for (const id of DEFAULT_CARD_ORDER) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }

  // Validate spans against min/max
  const spans: Record<string, number> = {};
  for (const config of CARD_CONFIGS) {
    const storedSpan = stored.cardSpans[config.id];
    if (
      typeof storedSpan === "number" &&
      storedSpan >= config.minSpan &&
      storedSpan <= config.maxSpan
    ) {
      spans[config.id] = storedSpan;
    } else {
      spans[config.id] = config.defaultSpan;
    }
  }

  return { cardOrder: order, cardSpans: spans };
}

function loadLayout(): DashboardLayout {
  if (typeof window === "undefined") {
    return { cardOrder: DEFAULT_CARD_ORDER, cardSpans: { ...DEFAULT_CARD_SPANS } };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DashboardLayout;
      return validateLayout(parsed);
    }
  } catch {
    // ignore corrupt data
  }

  return { cardOrder: DEFAULT_CARD_ORDER, cardSpans: { ...DEFAULT_CARD_SPANS } };
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(loadLayout);
  const [isEditMode, setIsEditMode] = useState(false);

  // Persist to localStorage whenever layout changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // storage full or unavailable
    }
  }, [layout]);

  const reorderCards = useCallback((newOrder: string[]) => {
    setLayout((prev) => ({ ...prev, cardOrder: newOrder }));
  }, []);

  const setCardSpan = useCallback((cardId: string, span: number) => {
    const config = CARD_CONFIGS.find((c) => c.id === cardId);
    if (!config) return;
    const clamped = Math.max(config.minSpan, Math.min(config.maxSpan, span));
    setLayout((prev) => ({
      ...prev,
      cardSpans: { ...prev.cardSpans, [cardId]: clamped },
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout({
      cardOrder: DEFAULT_CARD_ORDER,
      cardSpans: { ...DEFAULT_CARD_SPANS },
    });
  }, []);

  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => !prev);
  }, []);

  return {
    cardOrder: layout.cardOrder,
    cardSpans: layout.cardSpans,
    isEditMode,
    toggleEditMode,
    reorderCards,
    setCardSpan,
    resetLayout,
  };
}
