import type { ActionRiskTier, ActionSafetyGate } from "@/lib/ghl/action-safety";

export type AgentRunStatus = "queued" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";

export type AgentActionStatus =
  | "drafted"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "executing"
  | "executed"
  | "failed"
  | "cancelled";

export type AgentApprovalDecision = "approved" | "rejected";

export interface AgentRetryPolicy {
  max_attempts: number;
  backoff: "none" | "fixed" | "exponential";
  delay_seconds?: number;
}

export interface AgentRunRecord {
  id: string;
  agent_key: string;
  agent_name: string | null;
  status: AgentRunStatus;
  requested_by_user_id: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  output_schema_version: "agent-run.v1";
  retry_policy: AgentRetryPolicy;
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentActionRecord {
  id: string;
  run_id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  status: AgentActionStatus;
  risk_tier: ActionRiskTier;
  requires_human_approval: true;
  proposed_payload: Record<string, unknown>;
  final_payload: Record<string, unknown> | null;
  provider_gate: Record<string, unknown>;
  suppression_checks: Record<string, unknown>;
  quiet_hours_check: Record<string, unknown>;
  send_cap_check: Record<string, unknown>;
  template_check: Record<string, unknown>;
  output_schema_version: "agent-action.v1";
  retry_policy: AgentRetryPolicy;
  created_at: string;
  approved_at: string | null;
  executed_at: string | null;
}

export interface AgentRunEventRecord {
  id: string;
  run_id: string;
  action_id: string | null;
  event_type: string;
  event_payload: Record<string, unknown>;
  output_schema_version: "agent-run-event.v1";
  created_at: string;
}

export interface AgentApprovalRecord {
  id: string;
  run_id: string | null;
  action_id: string;
  requested_by_user_id: string | null;
  decided_by_user_id: string | null;
  decision: AgentApprovalDecision;
  decision_reason: string | null;
  final_payload: Record<string, unknown> | null;
  approval_source: "human_control_plane";
  output_schema_version: "agent-approval.v1";
  created_at: string;
}

export interface CustomerFacingSendApprovalContract {
  output_schema_version: "send-safety.v1";
  risk_tier: Extract<ActionRiskTier, "high" | "critical">;
  required_gates: ActionSafetyGate[];
  approved_by_user_id: string;
  approval_log_id: string;
}
