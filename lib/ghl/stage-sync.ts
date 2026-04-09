/**
 * Stage Sync Write-Through
 *
 * On every pipeline stage change in NAH OS, automatically writes
 * the new stage to the corresponding GHL custom field.
 *
 * This is automatic — does NOT require Draft → Review → Confirm
 * (it mirrors our state, not an independent action).
 *
 * Logs to scout_action_logs with was_auto: true.
 * On failure: retries 3x, then alerts admin.
 */

import { createServerClient } from "@/lib/supabase/server";
import * as ghl from "@/lib/ghl/client";

/**
 * Pipeline slug → GHL custom field key mapping.
 * These field IDs are stored in app_settings and discovered via scripts/ghl-id-discovery.ts.
 */
const PIPELINE_FIELD_MAP: Record<string, string> = {
  sales: "nah_sales_stage_id",
  followup: "nah_follow_up_stage_id",
  onboarding: "nah_onboarding_stage_id",
};

/**
 * Sync a stage change to GHL.
 * Called after any stage move in NAH OS.
 */
export async function syncStageToGHL(
  contactId: string,
  pipelineSlug: string,
  newStageSlug: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();

  // Get GHL contact ID
  const { data: contact } = await supabase
    .from("contacts")
    .select("ghl_contact_id")
    .eq("id", contactId)
    .single();

  if (!contact?.ghl_contact_id) {
    return { success: false, error: "No GHL contact ID found" };
  }

  // Get the custom field key for this pipeline
  const fieldKey = PIPELINE_FIELD_MAP[pipelineSlug];
  if (!fieldKey) {
    return { success: false, error: `No GHL field mapping for pipeline: ${pipelineSlug}` };
  }

  // Get the GHL custom field ID from app_settings
  const { data: fieldSetting } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "ghl_custom_fields")
    .single();

  let ghlFieldId: string | null = null;
  if (fieldSetting?.setting_value) {
    const fields = typeof fieldSetting.setting_value === "string"
      ? JSON.parse(fieldSetting.setting_value)
      : fieldSetting.setting_value;
    ghlFieldId = fields[fieldKey] ?? null;
  }

  // Fallback: check pipelines table for ghl_field_id
  if (!ghlFieldId) {
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("ghl_field_id")
      .eq("slug", pipelineSlug)
      .single();
    ghlFieldId = pipeline?.ghl_field_id ?? null;
  }

  if (!ghlFieldId) {
    return { success: false, error: `GHL field ID not found for ${fieldKey}` };
  }

  // Retry up to 3 times
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await ghl.updateContact(contact.ghl_contact_id, {
        customFields: [{ id: ghlFieldId, value: newStageSlug }],
      });

      // Log success
      await supabase.from("system_logs").insert({
        action_type: "ghl_stage_sync",
        contact_id: contactId,
        input_params: {
          pipeline: pipelineSlug,
          stage: newStageSlug,
          ghl_field_id: ghlFieldId,
          ghl_contact_id: contact.ghl_contact_id,
        },
        result_summary: `Synced ${pipelineSlug} stage to "${newStageSlug}" in GHL`,
        was_auto: true,
      });

      return { success: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  // All retries failed — log failure and alert
  await supabase.from("system_logs").insert({
    action_type: "ghl_stage_sync_failed",
    contact_id: contactId,
    input_params: {
      pipeline: pipelineSlug,
      stage: newStageSlug,
      attempts: 3,
    },
    result_summary: `Stage sync FAILED after 3 attempts: ${lastError}`,
    was_auto: true,
  });

  return { success: false, error: lastError ?? "Unknown error after 3 retries" };
}
