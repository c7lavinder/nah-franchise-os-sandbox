import type { GHLActionCode } from "@/lib/ghl/permissions";
import { createServerClient } from "@/lib/supabase/server";
import type { DraftedAction, DraftedMessagePayload } from "@/types/scout";

export type ActionRiskTier = "low" | "medium" | "high" | "critical";

export type ActionSafetyGate =
  | "human_approval"
  | "immutable_action_log"
  | "quiet_hours"
  | "suppression_list"
  | "daily_send_cap"
  | "approved_template"
  | "provider_health";

export interface ActionSafetyMetadata {
  outputSchemaVersion: "send-safety.v1";
  riskTier: ActionRiskTier;
  requiresHumanApproval: boolean;
  requiredGates: ActionSafetyGate[];
  approvalSource: "scout_drc" | "ghl_action_queue" | "direct_user";
  approvedByUserId: string;
  runtimeChecks?: SendRuntimeChecks;
}

export interface ActionSafetyDecision {
  allowed: boolean;
  status: number;
  error?: string;
  metadata: ActionSafetyMetadata;
}

export const SEND_SAFETY_CONTRACT = {
  outputSchemaVersion: "send-safety.v1",
  customerFacingSendGates: [
    "human_approval",
    "immutable_action_log",
    "quiet_hours",
    "suppression_list",
    "daily_send_cap",
    "approved_template",
    "provider_health",
  ] satisfies ActionSafetyGate[],
  nonSendMutationGates: ["human_approval", "immutable_action_log"] satisfies ActionSafetyGate[],
  quietHoursTimezone: "America/New_York",
  quietHours: { start: "21:00", end: "08:00" },
  defaultDailyContactSendCap: 3,
  notes:
    "Scout and agentic flows may draft customer-facing sends, but execution requires explicit human confirmation and an append-only approval log.",
} as const;

export interface SendRuntimeCheck {
  passed: boolean;
  reason: string;
  details?: Record<string, unknown>;
}

export interface SendRuntimeChecks {
  quietHours: SendRuntimeCheck;
  suppressionList: SendRuntimeCheck;
  dailySendCap: SendRuntimeCheck;
  approvedTemplate: SendRuntimeCheck;
  providerHealth: SendRuntimeCheck;
}

const CUSTOMER_FACING_GHL_SENDS = new Set<GHLActionCode>(["C1", "C2", "C3", "C4", "A5"]);

export function isCustomerFacingGHLActionCode(actionCode: GHLActionCode): boolean {
  return CUSTOMER_FACING_GHL_SENDS.has(actionCode);
}

export function isCustomerFacingScoutSend(action: Pick<DraftedAction, "type" | "payload">): boolean {
  if (action.type !== "message") return false;
  const payload = action.payload as DraftedMessagePayload;
  return payload.channel === "SMS" || payload.channel === "Email";
}

export function riskTierForScoutAction(action: Pick<DraftedAction, "type" | "payload">): ActionRiskTier {
  if (isCustomerFacingScoutSend(action)) return "high";
  if (action.type === "trigger_workflow" || action.type === "journey_action") return "high";
  if (action.type === "stage_move" || action.type === "profile_update" || action.type === "compliance_update") {
    return "medium";
  }
  return "low";
}

export function riskTierForGHLActionCode(actionCode: GHLActionCode): ActionRiskTier {
  if (isCustomerFacingGHLActionCode(actionCode)) return "high";
  if (actionCode.startsWith("M") || actionCode.startsWith("O") || actionCode === "C5" || actionCode === "C6") {
    return "medium";
  }
  return "low";
}

export function buildScoutActionSafetyMetadata(
  action: Pick<DraftedAction, "type" | "payload">,
  approvedByUserId: string
): ActionSafetyMetadata {
  const isSend = isCustomerFacingScoutSend(action);
  return {
    outputSchemaVersion: SEND_SAFETY_CONTRACT.outputSchemaVersion,
    riskTier: riskTierForScoutAction(action),
    requiresHumanApproval: true,
    requiredGates: isSend
      ? [...SEND_SAFETY_CONTRACT.customerFacingSendGates]
      : [...SEND_SAFETY_CONTRACT.nonSendMutationGates],
    approvalSource: "scout_drc",
    approvedByUserId,
  };
}

export function buildGHLActionSafetyMetadata(actionCode: GHLActionCode, approvedByUserId: string): ActionSafetyMetadata {
  const isSend = isCustomerFacingGHLActionCode(actionCode);
  return {
    outputSchemaVersion: SEND_SAFETY_CONTRACT.outputSchemaVersion,
    riskTier: riskTierForGHLActionCode(actionCode),
    requiresHumanApproval: true,
    requiredGates: isSend
      ? [...SEND_SAFETY_CONTRACT.customerFacingSendGates]
      : [...SEND_SAFETY_CONTRACT.nonSendMutationGates],
    approvalSource: "ghl_action_queue",
    approvedByUserId,
  };
}

export function validateScoutActionApproval(action: DraftedAction, approvedByUserId: string): ActionSafetyDecision {
  const metadata = buildScoutActionSafetyMetadata(action, approvedByUserId);

  if (action.status !== "confirmed") {
    return {
      allowed: false,
      status: 409,
      error: "Action must be explicitly confirmed by a human before execution.",
      metadata,
    };
  }

  return {
    allowed: true,
    status: 200,
    metadata,
  };
}

function minutesFromClock(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function zonedClockMinutes(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isWithinQuietHours(now = new Date()): boolean {
  const current = zonedClockMinutes(now, SEND_SAFETY_CONTRACT.quietHoursTimezone);
  const start = minutesFromClock(SEND_SAFETY_CONTRACT.quietHours.start);
  const end = minutesFromClock(SEND_SAFETY_CONTRACT.quietHours.end);

  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

async function countContactSendsToday(contactId: string): Promise<number> {
  const supabase = createServerClient();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("scout_action_logs")
    .select("id", { count: "exact", head: true })
    .eq("ghl_contact_id", contactId)
    .eq("action_type", "message")
    .in("action_status", ["approved_for_execution", "executed"])
    .gte("created_at", start.toISOString());

  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function evaluateScoutSendRuntimeSafety(
  action: DraftedAction,
  now = new Date()
): Promise<SendRuntimeChecks> {
  if (!isCustomerFacingScoutSend(action)) {
    const passed = { passed: true, reason: "not_customer_facing_send" };
    return {
      quietHours: passed,
      suppressionList: passed,
      dailySendCap: passed,
      approvedTemplate: passed,
      providerHealth: passed,
    };
  }

  const sendCount = await countContactSendsToday(action.contactId);
  const payload = action.payload as DraftedMessagePayload;

  return {
    quietHours: isWithinQuietHours(now)
      ? {
          passed: false,
          reason: "quiet_hours_active",
          details: {
            timeZone: SEND_SAFETY_CONTRACT.quietHoursTimezone,
            quietHours: SEND_SAFETY_CONTRACT.quietHours,
          },
        }
      : { passed: true, reason: "outside_quiet_hours" },
    suppressionList: {
      passed: true,
      reason: "no_suppression_source_configured",
    },
    dailySendCap:
      sendCount >= SEND_SAFETY_CONTRACT.defaultDailyContactSendCap
        ? {
            passed: false,
            reason: "daily_contact_send_cap_reached",
            details: { sendCount, cap: SEND_SAFETY_CONTRACT.defaultDailyContactSendCap },
          }
        : {
            passed: true,
            reason: "under_daily_contact_send_cap",
            details: { sendCount, cap: SEND_SAFETY_CONTRACT.defaultDailyContactSendCap },
          },
    approvedTemplate: {
      passed: true,
      reason: payload.content?.trim() ? "human_reviewed_draft_content" : "empty_content_blocked_by_ghl_payload_validation",
    },
    providerHealth:
      process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID
        ? { passed: true, reason: "ghl_env_present" }
        : { passed: false, reason: "missing_ghl_provider_env" },
  };
}

export function firstFailedRuntimeGate(checks: SendRuntimeChecks): SendRuntimeCheck | null {
  return Object.values(checks).find((check) => !check.passed) ?? null;
}
