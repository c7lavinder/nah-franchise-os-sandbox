/**
 * Auto-Save Extractions — Phase 1a of the Retrieval Brain
 *
 * After the post-call agent writes extractions to call_data_extractions,
 * this module saves eligible ones directly to profile data stores:
 *
 * - High confidence: saved with last_updated_by/source = 'ai-auto' / 'scout_extraction'
 * - Medium confidence: saved with last_updated_by = 'ai' for contact profile fields
 * - Low confidence: skipped
 * - Manual values (last_updated_by = 'manual') are NEVER overwritten
 *
 * Also triggers intelligence score recalculation after saves.
 */

import { createServerClient } from "@/lib/supabase/server";
import { isValidFieldName } from "@/lib/profile/field-registry";
import { updateCandidateScore } from "@/lib/intelligence/scoring";
import { MARKET_FIELDS } from "@/lib/territory/market-field-registry";

type ConfidenceLevel = "high" | "medium" | "low";

const MARKET_FIELD_NAMES = new Set(MARKET_FIELDS.map((field) => field.name));

interface AutoSaveResult {
  saved: number;
  skipped: number;
  highConfidence: number;
  mediumConfidence: number;
  manualProtected: number;
  contactsUpdated: string[];
  territoriesUpdated: string[];
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
    territoriesUpdated: [],
  };

  // Fetch unsaved extractions that can be safely applied without review.
  const { data: extractions, error } = await supabase
    .from("call_data_extractions")
    .select("id, contact_id, TerritorySlug, field_key, field_category, extracted_value, confidence")
    .eq("call_id", callId)
    .eq("saved_to_profile", false)
    .eq("dismissed", false)
    .eq("auto_saved", false)
    .in("field_category", ["contact", "contact_eos", "territory_market"]);

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
  const territorySavedExtractionIds: string[] = [];
  const territoriesWithSaves = new Set<string>();

  for (const ext of extractions) {
    if (!ext.extracted_value) {
      result.skipped++;
      continue;
    }

    const confidence = normalizeConfidence(ext.confidence);
    if (!confidence || confidence === "low") {
      result.skipped++;
      continue;
    }

    if (ext.field_category === "territory_market") {
      if (!ext.TerritorySlug || confidence !== "high" || !MARKET_FIELD_NAMES.has(ext.field_key)) {
        result.skipped++;
        continue;
      }

      const now = new Date().toISOString();
      const { error: upsertError } = await supabase.from("territory_market_data").upsert(
        {
          TerritorySlug: ext.TerritorySlug,
          field_name: ext.field_key,
          field_value: String(ext.extracted_value),
          source: "scout_extraction",
          source_date: now,
          updated_at: now,
        },
        { onConflict: "TerritorySlug,field_name" }
      );

      if (upsertError) {
        console.error(
          `[auto-save] Failed to save territory field ${ext.field_key} for ${ext.TerritorySlug}:`,
          upsertError.message
        );
        result.skipped++;
        continue;
      }

      territorySavedExtractionIds.push(ext.id);
      territoriesWithSaves.add(ext.TerritorySlug);
      result.saved++;
      result.highConfidence++;
      continue;
    }

    if (!ext.contact_id) {
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

    const source = confidence === "high" ? "ai-auto" : "ai";

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

    if (confidence === "high") {
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

  if (territorySavedExtractionIds.length > 0) {
    await supabase
      .from("call_data_extractions")
      .update({ auto_saved: true, saved_to_profile: true })
      .in("id", territorySavedExtractionIds);
  }

  // Recalculate intelligence scores for affected contacts
  result.contactsUpdated = [...contactsWithSaves];
  result.territoriesUpdated = [...territoriesWithSaves];
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

function normalizeConfidence(confidence: unknown): ConfidenceLevel | null {
  if (typeof confidence === "string") {
    const text = confidence.trim().toLowerCase();
    if (text === "high" || text === "medium" || text === "low") return text;

    const numeric = Number(text);
    if (!Number.isNaN(numeric)) return normalizeNumericConfidence(numeric);
  }

  if (typeof confidence === "number") return normalizeNumericConfidence(confidence);

  return null;
}

function normalizeNumericConfidence(confidence: number): ConfidenceLevel {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}
