"use client";

import { useRef, useCallback, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { CARD_CONFIGS } from "@/lib/dashboard-cards";
import { useMediaQuery } from "@/hooks/use-media-query";

interface SortableCardProps {
  id: string;
  span: number;
  index: number;
  isEditMode: boolean;
  onSpanChange: (cardId: string, span: number) => void;
  children: React.ReactNode;
}

export function SortableCard({
  id,
  span,
  index,
  isEditMode,
  onSpanChange,
  children,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const maxCols = isDesktop ? 4 : 2;
  const effectiveSpan = Math.min(span, maxCols);

  const config = CARD_CONFIGS.find((c) => c.id === id);

  // --- Corner resize ---
  const cardRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{
    startX: number;
    colWidth: number;
    startSpan: number;
    lastCommittedSpan: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!cardRef.current || !config) return;
      e.stopPropagation();
      e.preventDefault();

      const rect = cardRef.current.getBoundingClientRect();
      const colWidth = rect.width / effectiveSpan;

      resizeRef.current = {
        startX: e.clientX,
        colWidth,
        startSpan: effectiveSpan,
        lastCommittedSpan: effectiveSpan,
      };
      setIsResizing(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [effectiveSpan, config]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = resizeRef.current;
      if (!state || !config) return;
      e.stopPropagation();

      const deltaX = e.clientX - state.startX;
      const targetWidth = state.startSpan * state.colWidth + deltaX;
      let newSpan = Math.round(targetWidth / state.colWidth);
      newSpan = Math.max(config.minSpan, Math.min(config.maxSpan, newSpan));
      newSpan = Math.max(1, Math.min(maxCols, newSpan));

      if (newSpan !== state.lastCommittedSpan) {
        state.lastCommittedSpan = newSpan;
        onSpanChange(id, newSpan);
      }
    },
    [config, maxCols, id, onSpanChange]
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      resizeRef.current = null;
      setIsResizing(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  // Translate-only transform — no scale, no size change
  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    transition: transition ?? undefined,
    gridColumn: `span ${effectiveSpan}`,
  };

  if (isDragging) {
    style.zIndex = 50;
    style.position = "relative";
  }

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (cardRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
      }}
      style={style}
      data-card-id={id}
      className={cn(
        "relative",
        isDragging &&
          "shadow-2xl shadow-black/50 ring-1 ring-green-500/20 rounded-2xl"
      )}
      {...(isEditMode ? { ...attributes, ...listeners } : {})}
    >
      {children}

      {/* Corner resize handle */}
      {isEditMode && config && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className={cn(
            "absolute bottom-0 right-0 z-30 flex h-8 w-8 cursor-se-resize items-end justify-end rounded-tl-xl rounded-br-2xl touch-none",
            isResizing && "bg-green-500/10"
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            className={cn(
              "mb-1.5 mr-1.5 transition-colors",
              isResizing ? "text-green-400" : "text-gray-500"
            )}
          >
            <line x1="10" y1="14" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="6" y1="14" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
