"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, DollarSign, ArrowRight } from "lucide-react";
import type { GHLOpportunity } from "@/types/ghl";

interface LeadCardProps {
  opportunity: GHLOpportunity;
  onMoveClick?: (opportunity: GHLOpportunity) => void;
  /** Intelligence score (0-100) if available */
  score?: number | null;
  /** Whether this contact has an intelligence profile (undefined = not checked) */
  hasIntelProfile?: boolean;
}

/** Calculate days since last update */
function daysInStage(updatedAt: string): number {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Status dot color */
function statusColor(status: string): string {
  switch (status) {
    case "open": return "bg-success";
    case "won": return "bg-warning";
    case "lost": return "bg-danger";
    default: return "bg-text-tertiary";
  }
}

/** Score badge color based on tier */
function scoreBadgeColor(score: number): string {
  if (score >= 70) return "bg-success/15 text-success border-success/25";
  if (score >= 40) return "bg-warning/15 text-[#d97706] border-warning/25";
  return "bg-danger/15 text-danger border-danger/25";
}

export default function LeadCard({ opportunity, onMoveClick, score, hasIntelProfile }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
    data: { opportunity },
  });

  const days = daysInStage(opportunity.updatedAt);
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        bg-bg-tertiary border border-border-default rounded-md px-3 py-2
        cursor-grab active:cursor-grabbing
        hover:border-border-hover hover:bg-bg-hover
        transition-colors duration-150
        ${isDragging ? "opacity-30" : "opacity-100"}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(opportunity.status)}`} />
            <p className="text-body-sm text-text-primary font-medium truncate">
              {opportunity.name}
            </p>
          </div>
          <div className="flex items-center gap-3 text-caption text-text-tertiary">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {days}d
            </span>
            {opportunity.monetaryValue ? (
              <span className="flex items-center gap-1">
                <DollarSign size={11} />
                {(opportunity.monetaryValue / 1000).toFixed(0)}k
              </span>
            ) : null}
            {score !== undefined && score !== null ? (
              <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold border ${scoreBadgeColor(score)}`}>
                {score}
              </span>
            ) : hasIntelProfile === false ? (
              <span
                className="w-4 h-4 rounded-full bg-bg-hover border border-border-default flex items-center justify-center text-[9px] text-text-tertiary"
                title="No intelligence profile — run bootstrap"
              >
                ?
              </span>
            ) : null}
          </div>
        </div>
        {/* Mobile move button — hidden on desktop where drag works */}
        {onMoveClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveClick(opportunity); }}
            className="lg:hidden p-1 text-text-tertiary hover:text-text-primary"
            title="Move to..."
          >
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
