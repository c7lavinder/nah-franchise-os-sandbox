/**
 * Auto-Create Pipeline State — creates a Sales Pipeline entry at Stage 1 Engagement.
 *
 * Per §1.18 of MASTER_PLAN.md:
 * - New contact in GHL → webhook → contact mirrored → Sales Pipeline entry created
 * - Outreach sub-task starts empty (no auto-log)
 * - Idempotent: if active row already exists, skip
 *
 * Phase 4 final: writes journey_pipeline_state directly (creates the
 * journey + primary membership via ensureJourneyForContact on the way).
 * cps is no longer touched.
 */

import { createServerClient } from "@/lib/supabase/server";
import { ensureJourneyForContact } from "@/lib/journeys/sync";

const SALES_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001";
const ENGAGEMENT_STAGE_ID = "b0000000-0000-0000-0000-000000000001";

/**
 * Creates a journey_pipeline_state row at Sales → Engagement with Outreach
 * as current sub-task. Returns the jps row UUID, or null if an active Sales
 * entry already exists on this contact's journey (idempotent).
 */
export async function autoCreatePipelineState(contactId: string): Promise<string | null> {
  const supabase = createServerClient();

  const journeyId = await ensureJourneyForContact(supabase, contactId);
  if (!journeyId) {
    throw new Error(`Auto-create pipeline state: no journey for contact ${contactId}`);
  }

  const { data: existing } = await supabase
    .from("journey_pipeline_state")
    .select("id")
    .eq("journey_id", journeyId)
    .eq("pipeline_id", SALES_PIPELINE_ID)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return null;
  }

  const { data: outreachTask } = await supabase
    .from("pipeline_sub_tasks")
    .select("id")
    .eq("slug", "outreach")
    .eq("stage_id", ENGAGEMENT_STAGE_ID)
    .single();

  const now = new Date().toISOString();

  const { data: stateRow, error } = await supabase
    .from("journey_pipeline_state")
    .insert({
      journey_id: journeyId,
      territory_ms_slug: null,
      pipeline_id: SALES_PIPELINE_ID,
      current_stage_id: ENGAGEMENT_STAGE_ID,
      current_sub_task_id: outreachTask?.id ?? null,
      current_sub_task_started_at: now,
      entered_pipeline_at: now,
      entered_current_stage_at: now,
      assigned_user_id: null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Auto-create pipeline state failed for contact ${contactId}: ${error.message}`);
  }

  await supabase.from("pipeline_stage_history").insert({
    journey_pipeline_state_id: stateRow.id,
    from_stage_id: null,
    to_stage_id: ENGAGEMENT_STAGE_ID,
    moved_by_user_id: null,
    reason: "Auto-created from GHL webhook — new contact",
    was_skip: false,
    was_revert: false,
    was_auto: true,
  });

  return stateRow.id;
}
