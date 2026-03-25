"use client";

/**
 * ApprovalQueue — displays pending workflow approvals for admin review.
 * Shows approval type, workflow name, who submitted, and approve/reject buttons.
 */

import { useState } from "react";
import { Check, X, Clock, Send, Pause, Archive, Beaker, RotateCcw, Trophy } from "lucide-react";

/** Minimal approval shape for the UI */
interface Approval {
  id: string;
  workflow_id: string;
  workflow_version_id: string | null;
  ab_test_id: string | null;
  approval_type: string;
  submitted_by: string;
  status: string;
  notes: string | null;
  submitted_at: string;
}

/** Icon and label for approval types */
const APPROVAL_TYPE_CONFIG: Record<string, {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  color: string;
}> = {
  publish: { icon: Send, label: "Publish Workflow", color: "#059669" },
  pause: { icon: Pause, label: "Pause Workflow", color: "#f5a800" },
  archive: { icon: Archive, label: "Archive Workflow", color: "#64748b" },
  ab_test_start: { icon: Beaker, label: "Start A/B Test", color: "#00a1e1" },
  ab_test_winner: { icon: Trophy, label: "Declare Winner", color: "#8b5cf6" },
  rollback: { icon: RotateCcw, label: "Rollback Version", color: "#ef4444" },
};

interface ApprovalQueueProps {
  approvals: Approval[];
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}

export default function ApprovalQueue({ approvals, onApprove, onReject }: ApprovalQueueProps) {
  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Check size={40} className="text-success mb-3" />
        <p className="text-body text-text-secondary">All clear</p>
        <p className="text-body-sm text-text-tertiary">No pending approvals</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {approvals.map((approval) => (
        <ApprovalRow
          key={approval.id}
          approval={approval}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </div>
  );
}

function ApprovalRow({
  approval,
  onApprove,
  onReject,
}: {
  approval: Approval;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [acting, setActing] = useState(false);
  const config = APPROVAL_TYPE_CONFIG[approval.approval_type] ?? APPROVAL_TYPE_CONFIG.publish;
  const Icon = config.icon;

  const timeAgo = getTimeAgo(approval.submitted_at);

  async function handleAction(action: "approve" | "reject") {
    setActing(true);
    if (action === "approve") {
      onApprove(approval.id);
    } else {
      onReject(approval.id);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border-default bg-surface-glass">
      {/* Type icon */}
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `${config.color}12`, color: config.color }}
      >
        <Icon size={16} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-medium text-text-primary">{config.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-caption text-text-tertiary flex items-center gap-1">
            <Clock size={11} /> {timeAgo}
          </span>
          {approval.notes && (
            <span className="text-caption text-text-secondary truncate">
              — {approval.notes}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => handleAction("reject")}
          disabled={acting}
          className="p-2 rounded-md text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
          title="Reject"
        >
          <X size={16} />
        </button>
        <button
          onClick={() => handleAction("approve")}
          disabled={acting}
          className="px-3 py-1.5 rounded-md bg-success text-white text-button hover:bg-success/90 transition-colors disabled:opacity-50 flex items-center gap-1"
          title="Approve"
        >
          <Check size={14} />
          Approve
        </button>
      </div>
    </div>
  );
}

/** Simple time ago formatter */
function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
