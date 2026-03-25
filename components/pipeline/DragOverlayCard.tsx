"use client";

import { Clock, DollarSign } from "lucide-react";
import type { GHLOpportunity } from "@/types/ghl";

interface DragOverlayCardProps {
  opportunity: GHLOpportunity;
}

function daysInStage(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
}

export default function DragOverlayCard({ opportunity }: DragOverlayCardProps) {
  const days = daysInStage(opportunity.updatedAt);

  return (
    <div className="w-52 bg-bg-tertiary border-2 border-nah-orange rounded-md px-3 py-2 shadow-lg rotate-2 opacity-90">
      <p className="text-body-sm text-text-primary font-medium truncate mb-1">
        {opportunity.name}
      </p>
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
      </div>
    </div>
  );
}
