"use client";

/**
 * StageCircle — renders a pipeline stage as a circle with 3 states.
 * Per §1.11: empty = not started, half = in progress, full = complete.
 */

import { Check, AlertTriangle } from "lucide-react";
import type { CircleState, ColorLabel } from "@/lib/contacts/stage-visual-state";

interface StageCircleProps {
  name: string;
  state: CircleState;
  logCount: number;
  isActive: boolean;
  isCurrent: boolean;
  colorLabel: ColorLabel | null;
  isExpanded: boolean;
  hasMissingLogs?: boolean;
  onClick: () => void;
}

const COLOR_DOT: Record<ColorLabel, string> = {
  fresh: "bg-[#2e7d32]",
  at_risk: "bg-[#e65100]",
  losing: "bg-[#c62828]",
};

export default function StageCircle({
  name,
  state,
  logCount,
  isActive,
  isCurrent,
  colorLabel,
  isExpanded,
  hasMissingLogs,
  onClick,
}: StageCircleProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center text-center group transition-all duration-200
        ${isExpanded ? "scale-110" : "hover:scale-105"}
      `}
    >
      {/* Circle */}
      <div
        className={`
          relative w-12 h-12 rounded-full flex items-center justify-center mb-1
          transition-all duration-200
          ${state === "full"
            ? "bg-nah-blue text-white shadow-md"
            : state === "half"
              ? "bg-nah-blue/20 border-2 border-nah-blue text-nah-blue"
              : "bg-bg-tertiary border-2 border-border-default text-text-tertiary"
          }
          ${isCurrent ? "ring-2 ring-nah-orange ring-offset-2 ring-offset-bg-primary" : ""}
          ${isExpanded ? "ring-2 ring-nah-blue ring-offset-1 ring-offset-bg-primary" : ""}
        `}
      >
        {/* Half-fill visual — left half colored */}
        {state === "half" && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-nah-blue/30 rounded-l-full" />
          </div>
        )}

        {/* Check icon for completed */}
        {state === "full" && <Check size={18} className="relative z-10" />}

        {/* Stage number for empty/half */}
        {state !== "full" && (
          <span className="relative z-10 text-xs font-bold">
            {name.charAt(0)}
          </span>
        )}
      </div>

      {/* Color label dot — on current stage */}
      {isCurrent && colorLabel && (
        <div className={`absolute top-0 right-0 w-3 h-3 rounded-full ${COLOR_DOT[colorLabel]} border-2 border-white`} />
      )}

      {/* Amber triangle — passed stage with missing required logs */}
      {hasMissingLogs && (
        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2">
          <AlertTriangle size={12} className="text-amber-500" />
        </div>
      )}

      {/* Log count badge */}
      {logCount > 0 && (
        <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-bg-tertiary text-text-primary text-[10px] font-bold flex items-center justify-center border border-border-default">
          {logCount}
        </span>
      )}

      {/* Label */}
      <span className={`
        text-[10px] leading-tight max-w-[64px] truncate
        ${isCurrent ? "text-nah-orange font-semibold" : isExpanded ? "text-nah-blue font-medium" : "text-text-tertiary"}
      `}>
        {name}
      </span>
    </button>
  );
}
