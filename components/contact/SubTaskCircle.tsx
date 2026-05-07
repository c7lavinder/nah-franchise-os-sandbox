"use client";

/**
 * SubTaskCircle — smaller circle for sub-tasks within a stage.
 * Per §1.11: empty / half / full, with name + state label beside it.
 */

import { Check, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { titleCase } from "@/lib/format/contact";
import type { CircleState } from "@/lib/contacts/stage-visual-state";

interface SubTaskCircleProps {
  name: string;
  state: CircleState;
  stateType: "single" | "two_state";
  firstStateLabel: string | null;
  secondStateLabel: string | null;
  logCount: number;
  isExpanded: boolean;
  isMissingLog?: boolean;
  onClick: () => void;
}

function getStateLabel(
  state: CircleState,
  stateType: "single" | "two_state",
  firstLabel: string | null,
  secondLabel: string | null
): string {
  if (stateType === "single") {
    return state === "full" ? "Complete" : "Not started";
  }
  if (state === "full") return secondLabel ?? "Complete";
  if (state === "half") return firstLabel ?? "In progress";
  return "Not started";
}

export default function SubTaskCircle({
  name,
  state,
  stateType,
  firstStateLabel,
  secondStateLabel,
  logCount,
  isExpanded,
  isMissingLog,
  onClick,
}: SubTaskCircleProps) {
  const label = getStateLabel(state, stateType, firstStateLabel, secondStateLabel);

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full py-1.5 rounded-md px-2 transition-colors text-left ${
        isMissingLog ? "bg-amber-50 hover:bg-amber-100/60" : "hover:bg-bg-hover"
      }`}
    >
      {/* Small circle */}
      <div
        className={`
          relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
          ${
            state === "full"
              ? "bg-success text-white"
              : state === "half"
                ? "bg-warning/20 border-2 border-warning text-warning"
                : isMissingLog
                  ? "bg-amber-100 border-2 border-amber-300 text-amber-600"
                  : "bg-bg-tertiary border-2 border-border-default text-text-tertiary"
          }
        `}
      >
        {state === "half" && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-warning/30 rounded-l-full" />
          </div>
        )}
        {state === "full" && <Check size={12} className="relative z-10" />}
        {isMissingLog && state === "empty" && <AlertTriangle size={11} className="relative z-10" />}
      </div>

      {/* Name + state label */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-body-sm font-medium truncate ${state === "full" ? "text-text-primary" : "text-text-secondary"}`}
        >
          {titleCase(name)}
        </p>
        <p
          className={`text-caption ${
            state === "full" ? "text-success" : state === "half" ? "text-warning" : "text-text-tertiary"
          }`}
        >
          {titleCase(label)}
        </p>
      </div>

      {/* Log count + expand chevron */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {logCount > 0 && (
          <span className="text-[10px] font-bold text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full">
            {logCount} {logCount === 1 ? "log" : "logs"}
          </span>
        )}
        {logCount > 0 &&
          (isExpanded ? (
            <ChevronDown size={12} className="text-text-tertiary" />
          ) : (
            <ChevronRight size={12} className="text-text-tertiary" />
          ))}
      </div>
    </button>
  );
}
