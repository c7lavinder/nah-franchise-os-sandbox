/**
 * Profile Field CRUD Operations
 *
 * Read/write contact profile fields from the contact_profile_fields table (EAV).
 * Handles source metadata tracking automatically.
 */

import { createServerClient } from "@/lib/supabase/server";
import { isValidFieldName } from "./field-registry";

export interface ProfileFieldValue {
  field_name: string;
  field_value: unknown;
  last_updated_by: "api" | "ai" | "ai-auto" | "manual" | "system";
  last_updated_at: string;
  source_history: Array<{
    value: unknown;
    updated_by: string;
    updated_at: string;
  }>;
}

/**
 * Get all profile fields for a contact.
 */
export async function getContactProfileFields(contactId: string): Promise<Record<string, ProfileFieldValue>> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("contact_profile_fields")
    .select("field_name, field_value, last_updated_by, last_updated_at, source_history")
    .eq("contact_id", contactId);

  if (error) {
    throw new Error(`Failed to get profile fields: ${error.message}`);
  }

  const fields: Record<string, ProfileFieldValue> = {};
  for (const row of data ?? []) {
    fields[row.field_name] = {
      field_name: row.field_name,
      field_value: row.field_value,
      last_updated_by: row.last_updated_by,
      last_updated_at: row.last_updated_at,
      source_history: row.source_history ?? [],
    };
  }

  return fields;
}

/**
 * Set a single profile field value for a contact.
 * Upserts: creates if doesn't exist, updates if exists.
 */
export async function setContactProfileField(
  contactId: string,
  fieldName: string,
  value: unknown,
  source: "api" | "ai" | "ai-auto" | "manual" | "system"
): Promise<void> {
  if (!isValidFieldName(fieldName)) {
    throw new Error(`Unknown profile field: ${fieldName}`);
  }

  const supabase = createServerClient();

  const { error } = await supabase.from("contact_profile_fields").upsert(
    {
      contact_id: contactId,
      field_name: fieldName,
      field_value: JSON.stringify(value),
      last_updated_by: source,
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id,field_name" }
  );

  if (error) {
    throw new Error(`Failed to set profile field: ${error.message}`);
  }
}

/**
 * Set multiple profile fields at once for a contact.
 */
export async function setContactProfileFields(
  contactId: string,
  fields: Record<string, unknown>,
  source: "api" | "ai" | "ai-auto" | "manual" | "system"
): Promise<{ updated: number; errors: string[] }> {
  const results = { updated: 0, errors: [] as string[] };

  for (const [fieldName, value] of Object.entries(fields)) {
    try {
      await setContactProfileField(contactId, fieldName, value, source);
      results.updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`${fieldName}: ${msg}`);
    }
  }

  return results;
}

/**
 * Get the count of Scout-suggested updates pending review.
 */
export async function getPendingSuggestionCount(contactId: string): Promise<number> {
  const supabase = createServerClient();

  const { count, error } = await supabase
    .from("contact_profile_fields")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .eq("last_updated_by", "ai");

  if (error) return 0;
  return count ?? 0;
}
