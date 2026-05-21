/**
 * Auto-Save Extractions — Phase 1a of the Retrieval Brain
 *
 * After the post-call agent writes extractions to call_data_extractions,
 * this module saves eligible ones directly to contact_profile_fields:
 *
 * - High confidence (≥0.85): saved with last_updated_by = 'ai-auto'
 * - Medium confidence (0.60-0.84): saved with last_updated_by = 'ai' (pending review)
 * - Low confidence (<0.60): skipped
 * - Manual values (last_updated_by = 'manual') are NEVER overwritten
 *
 * Also triggers intelligence score recalculation after saves.
 */

import { createServerClient } from "@/lib/supabase/server";
import { isValidFieldName } from "@/lib/profile/field-registry";
import { updateCandidateScore } from "@/lib/intelligence/scoring";

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.6;

interface AutoSaveResult {
  saved: number;
  skipped: number;
  highConfidence: number;
  mediumConfidence: number;
  manualProtected: number;
  contactsUpdated: string[];
}

export async function autoSaveExtractions(
  callId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<AutoSaveResult> {
  const result: AutoSaveResult = {
    saved: 0,
    skipped: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    manualProtected: 0,
    contactsUpdated: [],
  };

  // Fetch all unsaved contact-category extractions for this call
  const { data: extractions, error } = await supabase
    .from("call_data_extractions")
    .select("id, contact_id, field_key, field_category, extracted_value, confidence")
    .eq("call_id", callId)
    .eq("saved_to_profile", false)
    .eq("dismissed", false)
    .eq("auto_saved", false)
    .in("field_category", ["contact", "contact_eos"]);

  if (error || !extractions || extractions.length === 0) {
    return result;
  }

  // Get unique contact IDs to batch-fetch existing profile fields
  const contactIds = [...new Set(extractions.map((e) => e.contact_id).filter(Boolean))] as string[];
  const existingByContact = new Map<string, Map<string, string>>();

  for (const cid of contactIds) {
    const { data: fields } = await supabase
      .from("contact_profile_fields")
      .select("field_name, last_updated_by")
      .eq("contact_id", cid);

    const fieldMap = new Map<string, string>();
    for (const f of fields ?? []) {
      fieldMap.set(f.field_name, f.last_updated_by);
    }
    existingByContact.set(cid, fieldMap);
  }

  const savedExtractionIds: string[] = [];
  const contactsWithSaves = new Set<string>();

  for (const ext of extractions) {
    if (!ext.contact_id || !ext.extracted_value) {
      result.skipped++;
      continue;
    }

    const confidence = parseFloat(ext.confidence);
    if (isNaN(confidence) || confidence < MEDIUM_CONFIDENCE_THRESHOLD) {
      result.skipped++;
      continue;
    }

    // Only save fields that exist in the profile registry
    if (!isValidFieldName(ext.field_key)) {
      result.skipped++;
      continue;
    }

    // Never overwrite manual values
    const existingSource = existingByContact.get(ext.contact_id)?.get(ext.field_key);
    if (existingSource === "manual") {
      result.manualProtected++;
      result.skipped++;
      continue;
    }

    const source = confidence >= HIGH_CONFIDENCE_THRESHOLD ? "ai-auto" : "ai";

    const { error: upsertError } = await supabase.from("contact_profile_fields").upsert(
      {
        contact_id: ext.contact_id,
        field_name: ext.field_key,
        field_value: JSON.stringify(ext.extracted_value),
        last_updated_by: source,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: "contact_id,field_name" }
    );

    if (upsertError) {
      console.error(`[auto-save] Failed to save ${ext.field_key} for ${ext.contact_id}:`, upsertError.message);
      result.skipped++;
      continue;
    }

    savedExtractionIds.push(ext.id);
    contactsWithSaves.add(ext.contact_id);
    result.saved++;

    if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      result.highConfidence++;
    } else {
      result.mediumConfidence++;
    }
  }

  // Mark extractions as auto-saved
  if (savedExtractionIds.length > 0) {
    await supabase
      .from("call_data_extractions")
      .update({ auto_saved: true, saved_to_profile: true })
      .in("id", savedExtractionIds);
  }

  // Recalculate intelligence scores for affected contacts
  result.contactsUpdated = [...contactsWithSaves];
  for (const contactId of contactsWithSaves) {
    try {
      await updateCandidateScore(contactId, "extraction_auto_save", callId);
    } catch (err) {
      console.error(
        `[auto-save] Score recalc failed for ${contactId}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return result;
}
