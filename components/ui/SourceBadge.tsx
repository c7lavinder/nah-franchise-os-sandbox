"use client";

import { Sparkles, Globe, Database } from "lucide-react";

type Source = string | null | undefined;

const SOURCE_STYLES: Record<string, { bg: string; text: string; label: string; icon?: "sparkles" | "globe" | "database" }> = {
  ai:          { bg: "bg-purple-100", text: "text-purple-700", label: "AI",         icon: "sparkles" },
  scout:       { bg: "bg-purple-100", text: "text-purple-700", label: "AI",         icon: "sparkles" },
  census:      { bg: "bg-blue-100",   text: "text-blue-700",   label: "Census",     icon: "database" },
  zillow:      { bg: "bg-green-100",  text: "text-green-700",  label: "Zillow",     icon: "globe" },
  attom:       { bg: "bg-teal-100",   text: "text-teal-700",   label: "ATTOM",      icon: "database" },
  bls:         { bg: "bg-indigo-100", text: "text-indigo-700", label: "BLS",        icon: "database" },
  mastersuite: { bg: "bg-orange-100", text: "text-orange-700", label: "MasterSuite",icon: "globe" },
  calculated:  { bg: "bg-gray-100",   text: "text-gray-600",   label: "Calc",       icon: "database" },
  api:         { bg: "bg-blue-100",   text: "text-blue-700",   label: "API",        icon: "globe" },
  system:      { bg: "bg-gray-100",   text: "text-gray-600",   label: "System",     icon: "database" },
  carried_forward: { bg: "bg-amber-100", text: "text-amber-700", label: "From sales" },
};

const ICON_MAP = {
  sparkles: Sparkles,
  globe: Globe,
  database: Database,
};

interface Props {
  source: Source;
  className?: string;
}

export default function SourceBadge({ source, className = "" }: Props) {
  if (!source || source === "manual") return null;

  const style = SOURCE_STYLES[source] ?? { bg: "bg-gray-100", text: "text-gray-600", label: source };
  const IconComponent = style.icon ? ICON_MAP[style.icon] : null;

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${style.bg} ${style.text} ${className}`}
      title={`Source: ${source}`}
    >
      {IconComponent && <IconComponent className="h-2.5 w-2.5" />}
      {style.label}
    </span>
  );
}
