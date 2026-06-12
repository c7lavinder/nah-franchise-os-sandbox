"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * Workflows Dashboard — View 1
 *
 * Shows all workflows with health scores, enrollee counts, and primary metrics.
 * Split layout: workflow list on left, detail panel on right.
 * Header stats: total active, total enrolled, needing attention.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Workflow as WorkflowIcon, RefreshCw, Plus, AlertTriangle, Users, Zap, Folder, FolderOpen } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Workflow } from "@/lib/workflows/types";
import WorkflowCard from "@/components/workflows/WorkflowCard";
import WorkflowDetail from "@/components/workflows/WorkflowDetail";

import ApprovalQueue from "@/components/workflows/ApprovalQueue";
import PendingConfirmations from "@/components/workflows/PendingConfirmations";

type StatusFilter = "all" | "live" | "draft" | "paused" | "archived";
type WorkflowFolderId =
  | "all-sales"
  | "lead-capture"
  | "qualification"
  | "appointments"
  | "nurture"
  | "docs-compliance"
  | "ops-cleanup"
  | "proof-tests";

type WorkflowFolder = {
  id: WorkflowFolderId;
  label: string;
  description: string;
};

const WORKFLOW_FOLDERS: WorkflowFolder[] = [
  { id: "lead-capture", label: "Lead Capture", description: "Website forms, new leads, inbound requests" },
  { id: "qualification", label: "Qualification", description: "Hot/warm lead qualification and sales readiness" },
  { id: "appointments", label: "Appointments", description: "Booked calls, reminders, no-show recovery" },
  { id: "nurture", label: "Follow-up / Nurture", description: "Sales follow-up, reactivation, drip sequences" },
  { id: "docs-compliance", label: "Docs / Compliance", description: "NDA, FDD, funds, agreement steps" },
  { id: "ops-cleanup", label: "Sales Ops Cleanup", description: "Tasks, data cleanup, internal handoffs" },
  { id: "proof-tests", label: "Proof / Tests", description: "Archived proofs, safe tests, QA workflows" },
];

interface PendingApproval {
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

export default function WorkflowsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [folderFilter, setFolderFilter] = useState<WorkflowFolderId>("all-sales");
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);

  const fetchWorkflows = useCallback(async () => {
    try {
      setError(null);
      const statusParam = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const [wfRes, appRes] = await Promise.all([
        apiFetch(`/api/workflows${statusParam}`),
        apiFetch("/api/workflows/approvals"),
      ]);
      if (!wfRes.ok) throw new Error("Failed to load workflows");
      const wfData = await wfRes.json();
      setWorkflows(wfData.workflows ?? []);
      if (appRes.ok) {
        const appData = await appRes.json();
        setPendingApprovals(appData.approvals ?? []);
      }
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

  const folderCounts = WORKFLOW_FOLDERS.reduce<Record<WorkflowFolderId, number>>(
    (counts, folder) => {
      counts[folder.id] = workflows.filter((workflow) => categorizeWorkflow(workflow) === folder.id).length;
      return counts;
    },
    {
      "all-sales": workflows.length,
      "lead-capture": 0,
      qualification: 0,
      appointments: 0,
      nurture: 0,
      "docs-compliance": 0,
      "ops-cleanup": 0,
      "proof-tests": 0,
    }
  );

  const statusFilteredWorkflows =
    statusFilter === "all" ? workflows : workflows.filter((w) => w.status === statusFilter);
  const filteredWorkflows =
    folderFilter === "all-sales"
      ? statusFilteredWorkflows
      : statusFilteredWorkflows.filter((workflow) => categorizeWorkflow(workflow) === folderFilter);
  const groupedWorkflows = WORKFLOW_FOLDERS.map((folder) => ({
    ...folder,
    workflows: filteredWorkflows.filter((workflow) => categorizeWorkflow(workflow) === folder.id),
  })).filter((group) => group.workflows.length > 0);

  async function handleAction(workflowId: string, action: "pause" | "resume" | "clone" | "archive") {
    if (!user) return;

    // Map UI action to approval type
    const approvalTypeMap: Record<string, string> = {
      pause: "pause",
      resume: "publish",
      archive: "archive",
    };

    if (action === "clone") {
      // Clone doesn't need approval — creates a draft copy
      try {
        const wf = workflows.find((w) => w.id === workflowId);
        if (!wf) return;
        const res = await apiFetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${wf.name} (Copy)`,
            description: wf.description,
            workflowType: wf.workflow_type,
            triggerType: wf.trigger_type,
            triggerConfig: wf.trigger_config,
            exitConditions: wf.exit_conditions,
          }),
        });
        if (res.ok) void fetchWorkflows();
      } catch {
        /* silent */
      }
      return;
    }

    // Submit for approval
    const approvalType = approvalTypeMap[action];
    if (!approvalType) return;

    try {
      const res = await apiFetch(`/api/workflows/${workflowId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalType,
          submittedBy: user.id,
          notes: `${action} requested from dashboard`,
        }),
      });

      if (res.ok) {
        void fetchWorkflows();
      } else {
        const data = await res.json();
        console.error("Approval submission failed:", data.error);
      }
    } catch {
      /* silent */
    }
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
            onClick={() => {
              setLoading(true);
              void fetchWorkflows();
            }}
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-nah-blue" : "text-text-secondary"} />
          </button>
          <button
            onClick={() => router.push("/workflows/new")}
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

      {/* Pending approvals */}
      {pendingApprovals.length > 0 && (
        <div className="mb-4 flex-shrink-0">
          <p className="text-label-caps text-text-tertiary mb-2">PENDING APPROVALS ({pendingApprovals.length})</p>
          <ApprovalQueue
            approvals={pendingApprovals}
            onApprove={async (id) => {
              if (!user) return;
              await apiFetch(
                `/api/workflows/${pendingApprovals.find((a) => a.id === id)?.workflow_id}/approvals/${id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "approve", approvedBy: user.id }),
                }
              );
              void fetchWorkflows();
            }}
            onReject={async (id) => {
              if (!user) return;
              await apiFetch(
                `/api/workflows/${pendingApprovals.find((a) => a.id === id)?.workflow_id}/approvals/${id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "reject", approvedBy: user.id }),
                }
              );
              void fetchWorkflows();
            }}
          />
        </div>
      )}

      {/* Pending step confirmations (DRC pattern) */}
      <PendingConfirmations />

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
          <p className="text-body-sm text-danger">{error}</p>
        </div>
      )}

      {/* Content: list + detail split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 border border-border-default rounded-lg overflow-hidden min-h-0">
        {/* Workflow list — 2/5 */}
        <div className="lg:col-span-2 overflow-y-auto p-3 border-r border-border-default bg-bg-secondary/50">
          <div className="mb-3 rounded-lg border border-border-default bg-bg-primary p-2">
            <button
              onClick={() => setFolderFilter("all-sales")}
              className={`mb-1 flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors ${
                folderFilter === "all-sales"
                  ? "bg-[rgba(0,161,225,0.08)] text-text-primary"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {folderFilter === "all-sales" ? (
                  <FolderOpen size={16} className="flex-shrink-0 text-nah-blue" />
                ) : (
                  <Folder size={16} className="flex-shrink-0 text-text-tertiary" />
                )}
                <span className="truncate text-body-sm font-semibold">Sales</span>
              </span>
              <span className="ml-2 rounded-sm bg-bg-tertiary px-1.5 py-0.5 text-caption text-text-tertiary">
                {folderCounts["all-sales"]}
              </span>
            </button>
            <div className="space-y-1 border-l border-border-default pl-3">
              {WORKFLOW_FOLDERS.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setFolderFilter(folder.id)}
                  title={folder.description}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
                    folderFilter === folder.id
                      ? "bg-[rgba(0,161,225,0.08)] text-text-primary"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                >
                  <span className="min-w-0 truncate text-caption font-medium">{folder.label}</span>
                  <span className="ml-2 text-caption text-text-tertiary">{folderCounts[folder.id]}</span>
                </button>
              ))}
            </div>
          </div>

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
          ) : folderFilter === "all-sales" ? (
            <div className="space-y-4">
              {groupedWorkflows.map((group) => (
                <section key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="min-w-0">
                      <p className="truncate text-label-caps text-text-tertiary">{group.label}</p>
                      <p className="truncate text-caption text-text-tertiary">{group.description}</p>
                    </div>
                    <span className="ml-2 rounded-sm bg-bg-tertiary px-1.5 py-0.5 text-caption text-text-tertiary">
                      {group.workflows.length}
                    </span>
                  </div>
                  {group.workflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      isSelected={selectedWorkflow?.id === workflow.id}
                      onSelect={setSelectedWorkflow}
                      onAction={handleAction}
                    />
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  isSelected={selectedWorkflow?.id === workflow.id}
                  onSelect={setSelectedWorkflow}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel — 3/5 */}
        <div className="lg:col-span-3 bg-bg-primary flex flex-col min-h-0">
          {selectedWorkflow ? (
            <WorkflowDetail
              workflow={selectedWorkflow}
              onStatusChange={async (workflowId, newStatus) => {
                const patchRes = await apiFetch(`/api/workflows/${workflowId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: newStatus }),
                });
                if (!patchRes.ok) {
                  const errData = await patchRes.json().catch(() => ({ error: "Unknown error" }));
                  setError(errData.error ?? `Failed to change status to ${newStatus}`);
                  return;
                }
                // Refresh list and update selected
                const res = await apiFetch(`/api/workflows/${workflowId}`);
                if (res.ok) {
                  const data = await res.json();
                  setSelectedWorkflow(data.workflow);
                }
                void fetchWorkflows();
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <WorkflowIcon size={48} className="text-text-tertiary mb-4" />
              <p className="text-body-lg text-text-secondary mb-1">Select a workflow</p>
              <p className="text-body-sm text-text-tertiary max-w-xs">
                Click a workflow from the list to see its details, active enrollments, and Scout&apos;s health
                assessment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function categorizeWorkflow(workflow: Workflow): Exclude<WorkflowFolderId, "all-sales"> {
  const haystack = [
    workflow.name,
    workflow.description ?? "",
    workflow.workflow_type,
    workflow.trigger_type,
    String((workflow.trigger_config as { description?: unknown })?.description ?? ""),
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(proof|test|qa|x[h]?aka|sandbox)\b/.test(haystack)) return "proof-tests";
  if (/\b(appointment|calendar|booked|booking|call|no[-\s]?show|reminder)\b/.test(haystack)) return "appointments";
  if (/\b(nda|fdd|funds|agreement|contract|compliance|disclosure|docs?|document)\b/.test(haystack)) {
    return "docs-compliance";
  }
  if (/\b(clean|cleanup|task|owner|handoff|data|internal|notify|admin|ops)\b/.test(haystack)) return "ops-cleanup";
  if (/\b(qualif|hot|warm|score|ready|discovery|vet|candidate)\b/.test(haystack)) return "qualification";
  if (/\b(nurture|follow[-\s]?up|reactivat|drip|long[-\s]?term|cold|stale)\b/.test(haystack)) return "nurture";
  return "lead-capture";
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
      <span className="text-body-sm font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
