"use client";

/**
 * Workflows Dashboard — View 1
 *
 * Shows all workflows with health scores, enrollee counts, and primary metrics.
 * Split layout: workflow list on left, detail panel on right.
 * Header stats: total active, total enrolled, needing attention.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Workflow as WorkflowIcon, RefreshCw, Plus, AlertTriangle, Users, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Workflow } from "@/lib/workflows/types";
import WorkflowCard from "@/components/workflows/WorkflowCard";
import WorkflowDetail from "@/components/workflows/WorkflowDetail";
import CreateWorkflowModal from "@/components/workflows/CreateWorkflowModal";

type StatusFilter = "all" | "live" | "draft" | "paused" | "archived";

export default function WorkflowsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    try {
      setError(null);
      const statusParam = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const res = await fetch(`/api/workflows${statusParam}`);
      if (!res.ok) throw new Error("Failed to load workflows");
      const data = await res.json();
      setWorkflows(data.workflows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchWorkflows();
    const interval = setInterval(() => void fetchWorkflows(), 60000);
    return () => clearInterval(interval);
  }, [fetchWorkflows]);

  // Derived stats
  const liveWorkflows = workflows.filter((w) => w.status === "live");
  const totalEnrolled = workflows.reduce((sum, w) => sum + (w.active_enrollee_count ?? 0), 0);
  const needingAttention = workflows.filter(
    (w) => (w.health_score === "D" || w.health_score === "F") && w.status === "live"
  );

  const filteredWorkflows = statusFilter === "all"
    ? workflows
    : workflows.filter((w) => w.status === statusFilter);

  async function handleAction(workflowId: string, action: "pause" | "resume" | "clone" | "archive") {
    // For now, just log — full implementation comes with the approval flow
    console.log(`Workflow action: ${action} on ${workflowId}`);
    // TODO: Wire to approval API when built
    void fetchWorkflows();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <WorkflowIcon size={20} className="text-nah-blue" />
          <h1 className="font-headline text-page-title text-text-primary">Workflows</h1>
          <span className="text-caption text-text-tertiary ml-1">{workflows.length} total</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost p-1.5"
            onClick={() => { setLoading(true); void fetchWorkflows(); }}
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-nah-blue" : "text-text-secondary"} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-nah-blue text-white text-button hover:bg-nah-blue-hover transition-colors"
          >
            <Plus size={14} />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <StatPill icon={Zap} label="Live" value={liveWorkflows.length} color="#059669" />
        <StatPill icon={Users} label="Enrolled" value={totalEnrolled} color="#00a1e1" />
        {needingAttention.length > 0 && (
          <StatPill icon={AlertTriangle} label="Needs Attention" value={needingAttention.length} color="#ef4444" />
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 flex-shrink-0">
        {(["all", "live", "draft", "paused", "archived"] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1.5 rounded-md text-body-sm capitalize transition-colors ${
              statusFilter === filter
                ? "bg-nah-blue text-white"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
          <p className="text-body-sm text-danger">{error}</p>
        </div>
      )}

      {/* Content: list + detail split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 border border-border-default rounded-lg overflow-hidden min-h-0">
        {/* Workflow list — 2/5 */}
        <div className="lg:col-span-2 overflow-y-auto p-3 border-r border-border-default bg-bg-secondary/50 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-bg-tertiary border border-border-default rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <WorkflowIcon size={40} className="text-text-tertiary mb-3" />
              <p className="text-body text-text-secondary mb-1">No workflows found</p>
              <p className="text-body-sm text-text-tertiary">
                {statusFilter !== "all"
                  ? `No ${statusFilter} workflows. Try a different filter.`
                  : "Create your first workflow to get started."}
              </p>
            </div>
          ) : (
            filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                isSelected={selectedWorkflow?.id === workflow.id}
                onSelect={setSelectedWorkflow}
                onAction={handleAction}
              />
            ))
          )}
        </div>

        {/* Detail panel — 3/5 */}
        <div className="lg:col-span-3 bg-bg-primary flex flex-col min-h-0">
          {selectedWorkflow ? (
            <WorkflowDetail workflow={selectedWorkflow} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <WorkflowIcon size={48} className="text-text-tertiary mb-4" />
              <p className="text-body-lg text-text-secondary mb-1">Select a workflow</p>
              <p className="text-body-sm text-text-tertiary max-w-xs">
                Click a workflow from the list to see its details, active enrollments, and Scout&apos;s health assessment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Workflow Modal */}
      {showCreateModal && user && (
        <CreateWorkflowModal
          userId={user.id ?? ""}
          onClose={() => setShowCreateModal(false)}
          onCreate={(wf) => {
            setShowCreateModal(false);
            router.push(`/workflows/${wf.id}`);
          }}
        />
      )}
    </div>
  );
}

/** Small stat pill for the header stats bar */
/** Color to Tailwind class mapping for stat pills */
const PILL_ICON_CLASS: Record<string, string> = {
  "#059669": "text-success",
  "#00a1e1": "text-nah-blue",
  "#ef4444": "text-danger",
};

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
      style={{
        background: `${color}08`,
        borderColor: `${color}20`,
      }}
    >
      <Icon size={14} className={PILL_ICON_CLASS[color] ?? "text-text-secondary"} />
      <span className="text-body-sm text-text-secondary">{label}:</span>
      <span className="text-body-sm font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}
