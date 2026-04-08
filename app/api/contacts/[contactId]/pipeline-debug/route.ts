export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/:contactId/pipeline-debug
 *
 * Diagnostic endpoint — traces the full pipeline-state + logs resolution
 * to find where sub-task logs get lost.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();

  // Step 1: Resolve contact ID
  const localId = await resolveContactId(rawId);

  // Step 2: Find pipeline states
  const { data: pipelineStates, error: psError } = await supabase
    .from("contact_pipeline_state")
    .select("id, contact_id, pipeline_id, current_stage_id, is_active")
    .eq("contact_id", localId ?? rawId)
    .eq("is_active", true);

  // Step 3: For each pipeline state, count logs directly
  const logCounts: Record<string, number> = {};
  const sampleLogs: Record<string, unknown[]> = {};
  for (const ps of pipelineStates ?? []) {
    const { count } = await supabase
      .from("contact_sub_task_logs")
      .select("*", { count: "exact", head: true })
      .eq("contact_pipeline_state_id", ps.id);
    logCounts[ps.id] = count ?? 0;

    // Also fetch up to 5 actual logs
    const { data: logs, error: logErr } = await supabase
      .from("contact_sub_task_logs")
      .select("id, contact_pipeline_state_id, sub_task_id, state_advance, content_type, created_at, deleted_at")
      .eq("contact_pipeline_state_id", ps.id)
      .order("created_at", { ascending: false })
      .limit(5);
    sampleLogs[ps.id] = logs ?? [];
    if (logErr) {
      sampleLogs[ps.id + "_error"] = [logErr.message];
    }
  }

  // Step 4: Also try counting without deleted_at filter
  const logCountsWithDeleted: Record<string, number> = {};
  for (const ps of pipelineStates ?? []) {
    const { count } = await supabase
      .from("contact_sub_task_logs")
      .select("*", { count: "exact", head: true })
      .eq("contact_pipeline_state_id", ps.id)
      .is("deleted_at", null);
    logCountsWithDeleted[ps.id] = count ?? 0;
  }

  // Step 5: Check if there are orphaned logs with the raw contact ID
  const { data: orphanedCheck } = await supabase
    .from("contact_sub_task_logs")
    .select("id, contact_pipeline_state_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    rawId,
    resolvedLocalId: localId,
    pipelineStatesError: psError?.message ?? null,
    pipelineStates: pipelineStates ?? [],
    logCountsAll: logCounts,
    logCountsNotDeleted: logCountsWithDeleted,
    sampleLogs,
    recentGlobalLogs: orphanedCheck ?? [],
  });
}
