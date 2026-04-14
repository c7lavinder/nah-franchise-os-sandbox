"use client";

import { Sparkles, Globe, Pencil } from "lucide-react";

type Source = string | null | undefined;

/** Map every possible source string to one of 3 display categories */
function resolveCategory(source: string): "api" | "ai" | "manual" {
  switch (source) {
    case "ai":
    case "scout":
      return "ai";
    case "census":
    case "zillow":
    case "attom":
    case "bls":
    case "mastersuite":
    case "api":
    case "system":
    case "calculated":
    case "agent_research":
    case "carried_forward":
      return "api";
    case "manual":
      return "manual";
    default:
      return "manual";
  }
}

const BADGE_STYLES = {
  api:    { bg: "bg-green-100",  text: "text-green-700",  label: "API",    Icon: Globe },
  ai:     { bg: "bg-blue-100",   text: "text-blue-700",   label: "AI",     Icon: Sparkles },
  manual: { bg: "bg-orange-100", text: "text-orange-700", label: "Manual", Icon: Pencil },
} as const;

interface Props {
  source: Source;
  /** Set to true to show the manual badge (default: hidden for manual) */
  showManual?: boolean;
  className?: string;
}

export default function SourceBadge({ source, showManual = false, className = "" }: Props) {
  if (!source) return null;

  const cat = resolveCategory(source);
  if (cat === "manual" && !showManual) return null;

  const { bg, text, label, Icon } = BADGE_STYLES[cat];

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${bg} ${text} ${className}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
