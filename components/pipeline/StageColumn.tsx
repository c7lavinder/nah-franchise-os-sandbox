"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import type { GHLOpportunity } from "@/types/ghl";
import LeadCard from "./LeadCard";

interface StageColumnProps {
  stageId: string;
  stageName: string;
  opportunities: GHLOpportunity[];
  onMoveClick?: (opportunity: GHLOpportunity) => void;
}

const INITIAL_VISIBLE = 20;

export default function StageColumn({ stageId, stageName, opportunities, onMoveClick }: StageColumnProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const { setNodeRef, isOver } = useDroppable({ id: stageId });

  const visible = opportunities.slice(0, visibleCount);
  const hasMore = opportunities.length > visibleCount;

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-shrink-0 w-56 bg-bg-secondary border rounded-lg flex flex-col
        transition-colors duration-150
        ${isOver ? "border-nah-orange bg-nah-orange/5" : "border-border-default"}
      `}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border-default">
        <h3 className="text-body-sm text-text-primary font-semibold truncate">
          {stageName}
        </h3>
        <span className="text-caption text-text-tertiary">
          {opportunities.length} {opportunities.length === 1 ? "prospect" : "prospects"}
        </span>
      </div>

      {/* Card list */}
      <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[120px]">
        {visible.length === 0 && (
          <p className="text-caption text-text-tertiary text-center py-6">
            No leads
          </p>
        )}
        {visible.map((opp) => (
          <LeadCard
            key={opp.id}
            opportunity={opp}
            onMoveClick={onMoveClick}
          />
        ))}
        {hasMore && (
          <button
            onClick={() => setVisibleCount((c) => c + 20)}
            className="w-full py-1.5 text-caption text-text-tertiary hover:text-text-primary flex items-center justify-center gap-1"
          >
            <ChevronDown size={12} />
            Show {Math.min(20, opportunities.length - visibleCount)} more
          </button>
        )}
      </div>
    </div>
  );
}
