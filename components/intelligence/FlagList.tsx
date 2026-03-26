"use client";

/**
 * FlagList — displays active Scout-generated flags with severity indicators.
 * Each flag has a severity level (info, warning, critical), text, and timestamp.
 */

import { Info, AlertTriangle, AlertOctagon } from "lucide-react";

export interface IntelligenceFlag {
  text: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
}

interface FlagListProps {
  flags: IntelligenceFlag[];
}

const SEVERITY_CONFIG: Record<
  IntelligenceFlag["severity"],
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    iconClass: string;
    borderClass: string;
    bgClass: string;
  }
> = {
  info: {
    icon: Info,
    iconClass: "text-info",
    borderClass: "border-info/20",
    bgClass: "bg-info/5",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-warning",
    borderClass: "border-warning/20",
    bgClass: "bg-warning/5",
  },
  critical: {
    icon: AlertOctagon,
    iconClass: "text-danger",
    borderClass: "border-danger/20",
    bgClass: "bg-danger/5",
  },
};

/** Format an ISO timestamp as a relative "time ago" string */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (isNaN(then)) return "";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function FlagList({ flags }: FlagListProps) {
  if (flags.length === 0) {
    return (
      <p className="text-body-sm text-text-tertiary py-4 text-center">
        No active flags
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {flags.map((flag, idx) => {
        const config = SEVERITY_CONFIG[flag.severity];
        const Icon = config.icon;

        return (
          <div
            key={idx}
            className={`flex items-start gap-2.5 px-3 py-2.5 rounded-md border ${config.borderClass} ${config.bgClass}`}
          >
            <Icon size={15} className={`${config.iconClass} mt-0.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-body-sm text-text-primary">{flag.text}</p>
              <p className="text-caption text-text-tertiary mt-0.5">{timeAgo(flag.createdAt)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
