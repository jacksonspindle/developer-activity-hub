"use client";

import { useState, useCallback, useRef, useLayoutEffect } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableCard } from "@/components/sortable-card";

interface DashboardGridProps {
  cardOrder: string[];
  cardSpans: Record<string, number>;
  isEditMode: boolean;
  onReorder: (newOrder: string[]) => void;
  onSpanChange: (cardId: string, span: number) => void;
  renderCard: (cardId: string) => React.ReactNode;
}

export function DashboardGrid({
  cardOrder,
  cardSpans,
  isEditMode,
  onReorder,
  onSpanChange,
  renderCard,
}: DashboardGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    // Clear saved rects so FLIP doesn't run when the drag ends —
    // dnd-kit already animated the displacement during drag.
    prevRectsRef.current = new Map();
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (over && active.id !== over.id) {
        const oldIndex = cardOrder.indexOf(String(active.id));
        const newIndex = cardOrder.indexOf(String(over.id));
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorder(arrayMove(cardOrder, oldIndex, newIndex));
        }
      }
    },
    [cardOrder, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // ---- FLIP animation for smooth grid repositioning on resize ----
  useLayoutEffect(() => {
    // Skip during drag — dnd-kit handles displacement
    if (activeId) return;

    const container = containerRef.current;
    if (!container) return;

    const children = Array.from(container.children) as HTMLElement[];

    // Cancel any in-flight FLIP animations so we read true layout positions
    for (const child of children) {
      child.getAnimations().forEach((a) => {
        if (a instanceof CSSAnimation) return; // keep CSS animations
        a.cancel();
      });
    }

    // Read new (post-reflow) positions
    const newRects = new Map<string, DOMRect>();
    for (const child of children) {
      const id = child.dataset.cardId;
      if (id) newRects.set(id, child.getBoundingClientRect());
    }

    const oldRects = prevRectsRef.current;

    // Animate from old positions to new positions
    if (oldRects.size > 0) {
      for (const child of children) {
        const id = child.dataset.cardId;
        if (!id) continue;
        const oldRect = oldRects.get(id);
        const newRect = newRects.get(id);
        if (!oldRect || !newRect) continue;

        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;

        // Skip tiny movements
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;

        child.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" },
          ],
          {
            duration: 300,
            easing: "cubic-bezier(0.25, 1, 0.5, 1)",
            fill: "none",
          }
        );
      }
    }

    // Store positions for next render
    prevRectsRef.current = newRects;
  }, [cardOrder, cardSpans, activeId]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
        <div
          ref={containerRef}
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {cardOrder.map((cardId, index) => (
            <SortableCard
              key={cardId}
              id={cardId}
              span={cardSpans[cardId] ?? 1}
              index={index}
              isEditMode={isEditMode}
              onSpanChange={onSpanChange}
            >
              {renderCard(cardId)}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
