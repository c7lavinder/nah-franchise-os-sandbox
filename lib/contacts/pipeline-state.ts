/**
 * Sprint 4A — Pipeline state data fetching layer (read-only).
 *
 * Server-side functions for reading contact pipeline state, stages,
 * sub-tasks, logs, and stage history from Supabase.
 */

import { createServerClient } from "@/lib/supabase/server";

// ─── Types ───

export interface ContactPipelineState {
  id: string;
  contact_id: string;
  pipeline_id: string;
  current_stage_id: string;
  current_sub_task_id: string | null;
  current_sub_task_started_at: string | null;
  entered_pipeline_at: string;
  entered_current_stage_at: string;
  assigned_user_id: string | null;
  is_active: boolean;
  closed_reason: string | null;
  closed_at: string | null;
  pipeline_name: string;
  pipeline_slug: string;
}

export interface PipelineStage {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
  pipeline_id: string;
}

export interface PipelineSubTask {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  state_type: "single" | "two_state";
  first_state_label: string | null;
  second_state_label: string | null;
  default_logger_type: string;
  default_logger_user_id: string | null;
  is_required: boolean;
  stage_id: string;
}

export interface SubTaskLog {
  id: string;
  journey_pipeline_state_id: string;
  sub_task_id: string;
  logger_user_id: string | null;
  source: "manual" | "api" | "ai";
  state_advance: "first" | "second" | null;
  content_type: string;
  content_text: string | null;
  content_file_url: string | null;
  content_link_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  deleted_at: string | null;
  logger_name: string | null;
}

export interface StageHistoryEntry {
  id: string;
  journey_pipeline_state_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  moved_by_user_id: string | null;
  reason: string | null;
  was_skip: boolean;
  was_revert: boolean;
  was_auto: boolean;
  created_at: string;
  from_stage_name: string | null;
  to_stage_name: string;
  moved_by_name: string | null;
}

// ─── Data fetching functions ───

/**
 * Get all active pipeline states for a contact (by local contact UUID).
 *
 * Phase 4 full cutover: sources from journey_pipeline_state via the
 * contact's primary journey. For pipelines that fan out per territory
 * (runway/onboarding), the canonical jps row is chosen — NULL-territory
 * preferred (matches the legacy one-cps-per-pipeline shape), otherwise
 * the lowest-id active row. The returned `id` is now jps.id, not cps.id.
 * All downstream callers (getSubTaskLogs, getStageHistory, log writers)
 * have been updated accordingly.
 */
export async function getContactPipelineStates(contactId: string): Promise<ContactPipelineState[]> {
  const supabase = createServerClient();

  const { data: journey } = await supabase
    .from("journeys")
    .select("id")
    .eq("primary_contact_id", contactId)
    .maybeSingle();
  if (!journey?.id) return [];

  const { data, error } = await supabase
    .from("journey_pipeline_state")
    .select(`
      id, journey_id, pipeline_id, territory_ms_slug, current_stage_id, current_sub_task_id,
      current_sub_task_started_at, entered_pipeline_at, entered_current_stage_at,
      assigned_user_id, is_active, closed_reason, closed_at,
      pipelines (name, slug)
    `)
    .eq("journey_id", journey.id)
    .eq("is_active", true)
    .order("entered_pipeline_at", { ascending: false });

  if (error || !data) return [];

  // Fold per-pipeline: prefer NULL-territory rows, else the first by id.
  // Preserves the one-row-per-pipeline contract the lead page expects.
  const canonByPipeline = new Map<string, typeof data[number]>();
  for (const row of data) {
    const existing = canonByPipeline.get(row.pipeline_id);
    if (!existing) { canonByPipeline.set(row.pipeline_id, row); continue; }
    if (row.territory_ms_slug === null && existing.territory_ms_slug !== null) {
      canonByPipeline.set(row.pipeline_id, row);
    }
  }

  return [...canonByPipeline.values()].map((row) => {
    const pipeline = (row.pipelines as unknown) as { name: string; slug: string } | null;
    return {
      id: row.id,
      contact_id: contactId,
      pipeline_id: row.pipeline_id,
      current_stage_id: row.current_stage_id,
      current_sub_task_id: row.current_sub_task_id,
      current_sub_task_started_at: row.current_sub_task_started_at,
      entered_pipeline_at: row.entered_pipeline_at,
      entered_current_stage_at: row.entered_current_stage_at,
      assigned_user_id: row.assigned_user_id,
      is_active: row.is_active,
      closed_reason: row.closed_reason,
      closed_at: row.closed_at,
      pipeline_name: pipeline?.name ?? "Unknown",
      pipeline_slug: pipeline?.slug ?? "",
    };
  });
}

/** Get all stages for a pipeline, ordered by sort_order */
export async function getStagesForPipeline(pipelineId: string): Promise<PipelineStage[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id, slug, name, sort_order, is_terminal, pipeline_id")
    .eq("pipeline_id", pipelineId)
    .order("sort_order");

  if (error || !data) return [];
  return data;
}

/** Get all sub-tasks for a stage, ordered by sort_order */
export async function getSubTasksForStage(stageId: string): Promise<PipelineSubTask[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("pipeline_sub_tasks")
    .select("id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, default_logger_user_id, is_required, stage_id")
    .eq("stage_id", stageId)
    .order("sort_order");

  if (error || !data) return [];
  return data as PipelineSubTask[];
}

/**
 * Get sub-task logs for a pipeline state + sub_task, newest first.
 * Phase 4 full cutover: the passed id is now a jps id (contract change).
 * Logs are queried by journey_pipeline_state_id (every row backfilled).
 */
export async function getSubTaskLogs(
  journeyPipelineStateId: string,
  subTaskId?: string
): Promise<SubTaskLog[]> {
  const supabase = createServerClient();

  let query = supabase
    .from("contact_sub_task_logs")
    .select(`
      id, journey_pipeline_state_id, sub_task_id, logger_user_id,
      source, state_advance, content_type, content_text,
      content_file_url, content_link_url, metadata, created_at, deleted_at
    `)
    .eq("journey_pipeline_state_id", journeyPipelineStateId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (subTaskId) {
    query = query.eq("sub_task_id", subTaskId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("getSubTaskLogs error:", error?.message, { journeyPipelineStateId, subTaskId });
    return [];
  }

  // Look up user names separately (PostgREST FK join on users can fail silently)
  const userIds = [...new Set(data.map((d) => d.logger_user_id).filter(Boolean))];
  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: userData } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", userIds as string[]);
    for (const u of userData ?? []) {
      userMap.set(u.id, u.full_name);
    }
  }

  return data.map((row) => ({
    ...row,
    source: row.source as SubTaskLog["source"],
    state_advance: row.state_advance as SubTaskLog["state_advance"],
    logger_name: row.logger_user_id ? (userMap.get(row.logger_user_id) ?? null) : null,
  }));
}

/**
 * Get stage history for a pipeline state, newest first.
 * Phase 4 full cutover: queries by journey_pipeline_state_id (the passed
 * id is now jps.id; pre-cutover rows were backfilled with the jps FK).
 */
export async function getStageHistory(journeyPipelineStateId: string): Promise<StageHistoryEntry[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("pipeline_stage_history")
    .select(`
      id, journey_pipeline_state_id, from_stage_id, to_stage_id,
      moved_by_user_id, reason, was_skip, was_revert, was_auto, created_at
    `)
    .eq("journey_pipeline_state_id", journeyPipelineStateId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Look up stage names + user names
  const supabase2 = createServerClient();
  const stageIds = [...new Set(data.flatMap((d) => [d.from_stage_id, d.to_stage_id].filter(Boolean)))];
  const userIds = [...new Set(data.map((d) => d.moved_by_user_id).filter(Boolean))];

  const [stageRes, userRes] = await Promise.all([
    stageIds.length > 0
      ? supabase2.from("pipeline_stages").select("id, name").in("id", stageIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    userIds.length > 0
      ? supabase2.from("users").select("id, full_name").in("id", userIds as string[])
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const stageMap = new Map<string, string>();
  for (const s of (stageRes as { data: { id: string; name: string }[] | null }).data ?? []) {
    stageMap.set(s.id, s.name);
  }
  const userMap = new Map<string, string>();
  for (const u of (userRes as { data: { id: string; full_name: string }[] | null }).data ?? []) {
    userMap.set(u.id, u.full_name);
  }

  return data.map((row) => ({
    ...row,
    from_stage_name: row.from_stage_id ? (stageMap.get(row.from_stage_id) ?? null) : null,
    to_stage_name: stageMap.get(row.to_stage_id) ?? "Unknown",
    moved_by_name: row.moved_by_user_id ? (userMap.get(row.moved_by_user_id) ?? null) : null,
  }));
}

/**
 * Resolve a contact identifier to a local contacts.id UUID.
 * The identifier may be a GHL contact ID or a local UUID.
 * Tries local UUID first (if it looks like a UUID), then GHL ID.
 */
export async function resolveContactId(identifier: string): Promise<string | null> {
  const supabase = createServerClient();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  if (isUUID) {
    // Sprint 4A bugfix: try local UUID first
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", identifier)
      .maybeSingle();
    if (data) return data.id;
  }

  // Fall back to GHL contact ID lookup
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .eq("ghl_contact_id", identifier)
    .maybeSingle();

  return data?.id ?? null;
}

/** Get contact details by local UUID or GHL ID */
export async function getContactByIdentifier(identifier: string): Promise<{
  id: string;
  ghl_contact_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  opportunity_source: string | null;
  sub_source: string | null;
  city: string | null;
  state: string | null;
  territory: string | null;
  territory_slug: string | null;
  legal_entity: string | null;
  website: string | null;
  franchise_fee: number | null;
  royalty_pct: number | null;
  term_months: number | null;
} | null> {
  const supabase = createServerClient();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  const fields = "id, ghl_contact_id, first_name, last_name, email, phone, opportunity_source, sub_source, city, state, territory, territory_slug, legal_entity, website, franchise_fee, royalty_pct, term_months";

  if (isUUID) {
    const { data } = await supabase.from("contacts").select(fields).eq("id", identifier).maybeSingle();
    if (data) return data;
  }

  const { data } = await supabase.from("contacts").select(fields).eq("ghl_contact_id", identifier).maybeSingle();
  return data ?? null;
}
