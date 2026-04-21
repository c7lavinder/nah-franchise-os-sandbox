/**
 * Auto-Create Pipeline State — creates a Sales Pipeline entry at Stage 1 Engagement.
 *
 * Per §1.18 of MASTER_PLAN.md:
 * - New contact in GHL → webhook → contact mirrored → Sales Pipeline entry created
 * - Outreach sub-task starts empty (no auto-log)
 * - Idempotent: if active row already exists for this contact + sales pipeline, skip
 *
 * Uses deterministic UUIDs from seed data:
 * - Sales pipeline: a0000000-0000-0000-0000-000000000001
 * - Engagement stage: b0000000-0000-0000-0000-000000000001
 */

import { createServerClient } from "@/lib/supabase/server";
import { syncJourneyForContact } from "@/lib/journeys/sync";

const SALES_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001";
const ENGAGEMENT_STAGE_ID = "b0000000-0000-0000-0000-000000000001";

/**
 * Creates a contact_pipeline_state row at Sales → Engagement with Outreach as current sub-task.
 * Returns the state row UUID, or null if one already exists (idempotent).
 */
export async function autoCreatePipelineState(contactId: string): Promise<string | null> {
  const supabase = createServerClient();

  // Check for existing active Sales pipeline entry
  const { data: existing } = await supabase
    .from("contact_pipeline_state")
    .select("id")
    .eq("contact_id", contactId)
    .eq("pipeline_id", SALES_PIPELINE_ID)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Already has an active Sales pipeline entry — skip
    return null;
  }

  // Look up the Outreach sub-task UUID (auto-generated, not deterministic)
  const { data: outreachTask } = await supabase
    .from("pipeline_sub_tasks")
    .select("id")
    .eq("slug", "outreach")
    .eq("stage_id", ENGAGEMENT_STAGE_ID)
    .single();

  const now = new Date().toISOString();

  const { data: stateRow, error } = await supabase
    .from("contact_pipeline_state")
    .insert({
      contact_id: contactId,
      pipeline_id: SALES_PIPELINE_ID,
      current_stage_id: ENGAGEMENT_STAGE_ID,
      current_sub_task_id: outreachTask?.id ?? null,
      current_sub_task_started_at: now,
      entered_pipeline_at: now,
      entered_current_stage_at: now,
      assigned_user_id: null, // Per §1.18: defaults to NULL, assigned later
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Auto-create pipeline state failed for contact ${contactId}: ${error.message}`);
  }

  // Write initial stage history entry
  await supabase.from("pipeline_stage_history").insert({
    contact_pipeline_state_id: stateRow.id,
    from_stage_id: null, // First entry
    to_stage_id: ENGAGEMENT_STAGE_ID,
    moved_by_user_id: null, // System auto-create
    reason: "Auto-created from GHL webhook — new contact",
    was_skip: false,
    was_revert: false,
    was_auto: true,
  });

  // Phase 2 dual-write: mirror onto journey_pipeline_state. Creates a journey
  // if one doesn't exist. Removed in Phase 4 after the read cutover.
  await syncJourneyForContact(supabase, contactId, SALES_PIPELINE_ID);

  return stateRow.id;
}
