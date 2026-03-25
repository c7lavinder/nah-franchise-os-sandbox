"use client";

/**
 * ABTestCard — displays a single A/B test with variant metrics and winner status.
 */

import { Beaker, Trophy, Clock, Users } from "lucide-react";

/** Minimal A/B test shape for the UI */
interface ABTest {
  id: string;
  workflow_id: string;
  test_type: "step" | "full_workflow";
  min_sample_size: number;
  variant_a_count: number;
  variant_b_count: number;
  variant_a_metric: number | null;
  variant_b_metric: number | null;
  winner: "A" | "B" | null;
  winner_explanation: string | null;
  status: "draft" | "pending_approval" | "running" | "complete" | "archived";
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#94a3b8" },
  pending_approval: { label: "Pending", color: "#f5a800" },
  running: { label: "Running", color: "#059669" },
  complete: { label: "Complete", color: "#00a1e1" },
  archived: { label: "Archived", color: "#64748b" },
};

interface ABTestCardProps {
  test: ABTest;
  onSelect: (test: ABTest) => void;
  isSelected: boolean;
}

export default function ABTestCard({ test, onSelect, isSelected }: ABTestCardProps) {
  const status = STATUS_CONFIG[test.status] ?? STATUS_CONFIG.draft;
  const totalSamples = test.variant_a_count + test.variant_b_count;
  const progress = test.min_sample_size > 0
    ? Math.min(100, Math.round((totalSamples / (test.min_sample_size * 2)) * 100))
    : 0;

  return (
    <button
      onClick={() => onSelect(test)}
      className={`w-full text-left p-4 rounded-lg border transition-all duration-150 ${
        isSelected
          ? "border-nah-blue bg-[rgba(0,161,225,0.05)]"
          : "border-border-default bg-surface-glass hover:border-border-hover"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Beaker size={16} className="text-nah-blue" />
          <span className="text-body-sm font-semibold text-text-primary capitalize">
            {test.test_type === "step" ? "Step Test" : "Full Workflow Test"}
          </span>
        </div>
        <span
          className="text-badge px-2 py-0.5 rounded-sm"
          style={{ color: status.color, background: `${status.color}15` }}
        >
          {status.label}
        </span>
      </div>

      {/* Variant comparison */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <VariantBar
          label="A"
          count={test.variant_a_count}
          metric={test.variant_a_metric}
          isWinner={test.winner === "A"}
          color="#00a1e1"
        />
        <VariantBar
          label="B"
          count={test.variant_b_count}
          metric={test.variant_b_metric}
          isWinner={test.winner === "B"}
          color="#8b5cf6"
        />
      </div>

      {/* Footer: progress + sample info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-caption text-text-tertiary">
          <Users size={12} />
          <span>{totalSamples} / {test.min_sample_size * 2} samples</span>
        </div>
        {test.status === "running" && (
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-nah-blue rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-caption text-text-tertiary">{progress}%</span>
          </div>
        )}
        {test.winner && (
          <div className="flex items-center gap-1 text-caption text-success">
            <Trophy size={12} />
            <span>Variant {test.winner} wins</span>
          </div>
        )}
        {test.status === "draft" && (
          <div className="flex items-center gap-1 text-caption text-text-tertiary">
            <Clock size={12} />
            <span>Awaiting approval</span>
          </div>
        )}
      </div>

      {/* Winner explanation */}
      {test.winner_explanation && (
        <p className="text-body-sm text-text-secondary mt-2 pt-2 border-t border-border-default">
          {test.winner_explanation}
        </p>
      )}
    </button>
  );
}

/** Visual bar showing variant performance */
function VariantBar({
  label,
  count,
  metric,
  isWinner,
  color,
}: {
  label: string;
  count: number;
  metric: number | null;
  isWinner: boolean;
  color: string;
}) {
  return (
    <div
      className={`px-3 py-2 rounded-md border ${
        isWinner ? "border-success/30 bg-success/5" : "border-border-default bg-bg-tertiary"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-badge font-bold" style={{ color }}>
          Variant {label}
        </span>
        {isWinner && <Trophy size={12} className="text-success" />}
      </div>
      <p className="text-metric-sm text-text-primary">
        {metric !== null ? `${metric}%` : "—"}
      </p>
      <p className="text-caption text-text-tertiary">{count} samples</p>
    </div>
  );
}
