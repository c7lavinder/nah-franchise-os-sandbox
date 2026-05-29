import { createServerClient } from "@/lib/supabase/server";
import {
  getWorkQueueStatusLabel,
  normalizeWorkQueueStatus,
  WORK_QUEUE_STATUS_LABELS,
  WORK_QUEUE_STATUS_ORDER,
  type WorkQueueStatus,
} from "./status";

export type WorkQueueSourceType = "stale_lead" | "ghl_action_draft";
export type WorkQueuePriority = "low" | "medium" | "high" | "critical";

export interface WorkQueueItem {
  id: string;
  sourceType: WorkQueueSourceType;
  sourceTable: string;
  sourceId: string;
  status: WorkQueueStatus;
  statusLabel: string;
  priority: WorkQueuePriority;
  title: string;
  description: string | null;
  contactId: string | null;
  ghlContactId: string | null;
  assignedUserId: string | null;
  dueAt: string | null;
  staleAt: string | null;
  completedAt: string | null;
  sourcePayload: Record<string, unknown>;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkQueueUpsert {
  source_type: WorkQueueSourceType;
  source_table: string;
  source_id: string;
  status: WorkQueueStatus;
  priority: WorkQueuePriority;
  title: string;
  description: string | null;
  contact_id: string | null;
  ghl_contact_id: string | null;
  assigned_user_id: string | null;
  due_at: string | null;
  stale_at: string | null;
  completed_at: string | null;
  source_payload: Record<string, unknown>;
  last_seen_at: string;
}

interface WorkQueueDbRow extends WorkQueueUpsert {
  id: string;
  created_at: string;
  updated_at: string;
}

interface StaleAlertRow {
  id: string;
  alert_type: string;
  severity: WorkQueuePriority;
  user_id: string | null;
  ghl_contact_id: string | null;
  pipeline_stage: string | null;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface GhlActionDraftRow {
  id: string;
  action_type: string;
  contact_id: string | null;
  drafted_by_user_id: string | null;
  drafted_by_source: string;
  params: Record<string, unknown> | null;
  created_at: string;
}

export const WORK_QUEUE_SOURCE_TYPES: WorkQueueSourceType[] = ["stale_lead", "ghl_action_draft"];

export const STALE_LEAD_ALERT_TYPES = [
  "stale_active",
  "stale_active_high",
  "stale_followup",
  "stale_nurture",
  "stale_reengaged",
] as const;

function priorityFromSeverity(severity: string | null | undefined): WorkQueuePriority {
  if (severity === "critical" || severity === "high" || severity === "medium" || severity === "low") {
    return severity;
  }
  return "medium";
}

function humanizeActionType(actionType: string): string {
  return actionType
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function mapStaleAlertToWorkQueueItem(alert: StaleAlertRow, nowIso = new Date().toISOString()): WorkQueueUpsert {
  return {
    source_type: "stale_lead",
    source_table: "inactivity_alerts",
    source_id: alert.id,
    status: "stale",
    priority: priorityFromSeverity(alert.severity),
    title: alert.message,
    description: alert.pipeline_stage ? `Pipeline stage: ${alert.pipeline_stage}` : null,
    contact_id: null,
    ghl_contact_id: alert.ghl_contact_id,
    assigned_user_id: alert.user_id,
    due_at: nowIso,
    stale_at: alert.created_at,
    completed_at: null,
    source_payload: {
      alertType: alert.alert_type,
      severity: alert.severity,
      details: alert.details ?? {},
    },
    last_seen_at: nowIso,
  };
}

export function mapGhlDraftToWorkQueueItem(
  draft: GhlActionDraftRow,
  nowIso = new Date().toISOString()
): WorkQueueUpsert {
  const label = humanizeActionType(draft.action_type);

  return {
    source_type: "ghl_action_draft",
    source_table: "ghl_action_drafts",
    source_id: draft.id,
    status: "needs_review",
    priority: "medium",
    title: `Review ${label} draft`,
    description:
      draft.drafted_by_source === "user" ? "User-created GHL action draft" : "Scout-created GHL action draft",
    contact_id: draft.contact_id,
    ghl_contact_id: null,
    assigned_user_id: draft.drafted_by_user_id,
    due_at: draft.created_at,
    stale_at: null,
    completed_at: null,
    source_payload: {
      actionType: draft.action_type,
      draftedBySource: draft.drafted_by_source,
      params: draft.params ?? {},
    },
    last_seen_at: nowIso,
  };
}

function toWorkQueueItem(row: WorkQueueDbRow): WorkQueueItem {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    status: row.status,
    statusLabel: getWorkQueueStatusLabel(row.status),
    priority: row.priority,
    title: row.title,
    description: row.description,
    contactId: row.contact_id,
    ghlContactId: row.ghl_contact_id,
    assignedUserId: row.assigned_user_id,
    dueAt: row.due_at,
    staleAt: row.stale_at,
    completedAt: row.completed_at,
    sourcePayload: row.source_payload,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sortWorkQueueItems(a: WorkQueueItem, b: WorkQueueItem): number {
  const statusDiff = WORK_QUEUE_STATUS_ORDER[a.status] - WORK_QUEUE_STATUS_ORDER[b.status];
  if (statusDiff !== 0) return statusDiff;

  const priorityRank: Record<WorkQueuePriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityDiff !== 0) return priorityDiff;

  const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  return aDue - bDue;
}

async function markMissingSourceItemsDone(
  db: any,
  sourceType: WorkQueueSourceType,
  activeSourceIds: Set<string>,
  assignedUserId?: string | null
): Promise<number> {
  let query = db.from("work_queue_items").select("id, source_id").eq("source_type", sourceType).neq("status", "done");

  if (assignedUserId) {
    query = query.or(`assigned_user_id.eq.${assignedUserId},assigned_user_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to inspect ${sourceType} queue items: ${error.message}`);

  const missingIds = ((data ?? []) as { id: string; source_id: string }[])
    .filter((row) => !activeSourceIds.has(row.source_id))
    .map((row) => row.id);

  if (missingIds.length === 0) return 0;

  const nowIso = new Date().toISOString();
  const { error: updateError } = await db
    .from("work_queue_items")
    .update({ status: "done", completed_at: nowIso })
    .in("id", missingIds);

  if (updateError) throw new Error(`Failed to close ${sourceType} queue items: ${updateError.message}`);
  return missingIds.length;
}

async function upsertSourceItems(db: any, rows: WorkQueueUpsert[]): Promise<number> {
  if (rows.length === 0) return 0;

  const { error } = await db.from("work_queue_items").upsert(rows, {
    onConflict: "source_type,source_id",
  });

  if (error) throw new Error(`Failed to upsert work queue items: ${error.message}`);
  return rows.length;
}

export async function syncWorkQueueSources(options?: {
  assignedUserId?: string | null;
  sourceTypes?: WorkQueueSourceType[];
}): Promise<{
  upserted: number;
  completed: number;
  bySource: Record<WorkQueueSourceType, { upserted: number; completed: number }>;
}> {
  const db = createServerClient() as any;
  const sourceTypes = options?.sourceTypes ?? WORK_QUEUE_SOURCE_TYPES;
  const nowIso = new Date().toISOString();
  const bySource: Record<WorkQueueSourceType, { upserted: number; completed: number }> = {
    stale_lead: { upserted: 0, completed: 0 },
    ghl_action_draft: { upserted: 0, completed: 0 },
  };

  if (sourceTypes.includes("stale_lead")) {
    let query = db
      .from("inactivity_alerts")
      .select("id, alert_type, severity, user_id, ghl_contact_id, pipeline_stage, message, details, created_at")
      .eq("is_resolved", false)
      .in("alert_type", [...STALE_LEAD_ALERT_TYPES]);

    if (options?.assignedUserId) {
      query = query.or(`user_id.eq.${options.assignedUserId},user_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to sync stale lead alerts: ${error.message}`);

    const rows = ((data ?? []) as StaleAlertRow[]).map((alert) => mapStaleAlertToWorkQueueItem(alert, nowIso));
    bySource.stale_lead.upserted = await upsertSourceItems(db, rows);
    bySource.stale_lead.completed = await markMissingSourceItemsDone(
      db,
      "stale_lead",
      new Set(rows.map((row) => row.source_id)),
      options?.assignedUserId
    );
  }

  if (sourceTypes.includes("ghl_action_draft")) {
    let query = db
      .from("ghl_action_drafts")
      .select("id, action_type, contact_id, drafted_by_user_id, drafted_by_source, params, created_at")
      .eq("status", "draft");

    if (options?.assignedUserId) {
      query = query.eq("drafted_by_user_id", options.assignedUserId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to sync GHL action drafts: ${error.message}`);

    const rows = ((data ?? []) as GhlActionDraftRow[]).map((draft) => mapGhlDraftToWorkQueueItem(draft, nowIso));
    bySource.ghl_action_draft.upserted = await upsertSourceItems(db, rows);
    bySource.ghl_action_draft.completed = await markMissingSourceItemsDone(
      db,
      "ghl_action_draft",
      new Set(rows.map((row) => row.source_id)),
      options?.assignedUserId
    );
  }

  return {
    upserted: Object.values(bySource).reduce((sum, value) => sum + value.upserted, 0),
    completed: Object.values(bySource).reduce((sum, value) => sum + value.completed, 0),
    bySource,
  };
}

export async function getWorkQueueItems(options?: {
  assignedUserId?: string | null;
  statuses?: WorkQueueStatus[];
  sourceType?: WorkQueueSourceType;
  includeDone?: boolean;
  limit?: number;
}): Promise<WorkQueueItem[]> {
  const db = createServerClient() as any;

  let query = db.from("work_queue_items").select("*");

  if (options?.assignedUserId) {
    query = query.or(`assigned_user_id.eq.${options.assignedUserId},assigned_user_id.is.null`);
  }
  if (options?.sourceType) {
    query = query.eq("source_type", options.sourceType);
  }
  if (options?.statuses?.length) {
    query = query.in("status", options.statuses);
  } else if (!options?.includeDone) {
    query = query.neq("status", "done");
  }

  query = query.order("due_at", { ascending: true, nullsFirst: false }).limit(options?.limit ?? 50);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch work queue: ${error.message}`);

  return ((data ?? []) as WorkQueueDbRow[]).map(toWorkQueueItem).sort(sortWorkQueueItems);
}

export function parseWorkQueueStatuses(value: string | null): WorkQueueStatus[] | null {
  if (!value) return null;
  const statuses = value
    .split(",")
    .map(normalizeWorkQueueStatus)
    .filter((status): status is WorkQueueStatus => Boolean(status));

  return statuses.length > 0 ? statuses : null;
}

export function isWorkQueueSourceType(value: string | null): value is WorkQueueSourceType {
  return value === "stale_lead" || value === "ghl_action_draft";
}

export { WORK_QUEUE_STATUS_LABELS };
