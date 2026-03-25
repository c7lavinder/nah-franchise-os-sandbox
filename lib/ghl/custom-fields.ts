/**
 * GHL Custom Field Resolver
 *
 * Per ghl-masterclass/knowledge/custom-fields.md:
 * - Custom field IDs are per-location — never hardcode
 * - Fetch definitions at boot, cache in memory
 * - Always use ID (not name) when writing to contacts
 * - Values are always strings, even for numbers/booleans/dates
 *
 * This module resolves human-readable field names to GHL field IDs.
 */

import { createServerClient } from "@/lib/supabase/server";

/** Cached field definitions — refreshed every 15 minutes */
let fieldCache: Map<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** GHL custom field definition from the API */
interface GHLFieldDefinition {
  id: string;
  name: string;
  fieldKey?: string;
  dataType: string;
}

/**
 * Resolve a human-readable field name to its GHL field ID.
 * Returns the field ID, or the original name if not found (best-effort).
 */
export async function resolveFieldId(fieldName: string): Promise<string> {
  const cache = await getFieldCache();
  return cache.get(fieldName.toLowerCase()) ?? fieldName;
}

/**
 * Resolve multiple field name→value pairs to field ID→value pairs.
 * Returns an array of { id, value } ready for GHL API calls.
 */
export async function resolveCustomFields(
  fields: Record<string, string | number | boolean>
): Promise<{ id: string; value: string }[]> {
  const cache = await getFieldCache();
  const resolved: { id: string; value: string }[] = [];

  for (const [name, value] of Object.entries(fields)) {
    const id = cache.get(name.toLowerCase()) ?? name;
    // GHL requires all values as strings
    resolved.push({ id, value: String(value) });
  }

  return resolved;
}

/**
 * Get or refresh the field definition cache.
 * Fetches from Supabase app_settings (cached from GHL API).
 * Falls back to GHL API directly if cache is empty.
 */
async function getFieldCache(): Promise<Map<string, string>> {
  const now = Date.now();
  if (fieldCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return fieldCache;
  }

  const supabase = createServerClient();

  // Try Supabase cache first
  const { data: cached } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "ghl_custom_field_map")
    .single();

  if (cached?.setting_value) {
    const map = new Map<string, string>();
    const entries = cached.setting_value as Record<string, string>;
    for (const [name, id] of Object.entries(entries)) {
      map.set(name.toLowerCase(), id);
    }
    fieldCache = map;
    cacheTimestamp = now;
    return map;
  }

  // Cache miss — fetch from GHL API and store
  const map = await fetchAndCacheFields();
  return map;
}

/**
 * Fetch custom field definitions from GHL API and cache in Supabase.
 * Called when the cache is empty or stale.
 */
async function fetchAndCacheFields(): Promise<Map<string, string>> {
  const locationId = process.env.GHL_LOCATION_ID;
  const apiKey = process.env.GHL_API_KEY;

  if (!locationId || !apiKey) {
    console.warn("GHL credentials not configured — custom field resolution will use names as IDs");
    fieldCache = new Map();
    cacheTimestamp = Date.now();
    return fieldCache;
  }

  try {
    const response = await fetch(
      `https://services.leadconnectorhq.com/locations/${locationId}/customFields`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch GHL custom fields: ${response.status}`);
      fieldCache = new Map();
      cacheTimestamp = Date.now();
      return fieldCache;
    }

    const data = await response.json() as { customFields: GHLFieldDefinition[] };
    const map = new Map<string, string>();
    const cacheObj: Record<string, string> = {};

    for (const field of data.customFields ?? []) {
      const key = field.name.toLowerCase();
      map.set(key, field.id);
      cacheObj[key] = field.id;

      // Also map by fieldKey if available (e.g., "contact.workflow_name")
      if (field.fieldKey) {
        const shortKey = field.fieldKey.replace("contact.", "").toLowerCase();
        map.set(shortKey, field.id);
        cacheObj[shortKey] = field.id;
      }
    }

    // Store in Supabase for faster subsequent loads
    const supabase = createServerClient();
    await supabase.from("app_settings").upsert(
      {
        setting_key: "ghl_custom_field_map",
        setting_value: cacheObj,
        description: "Cached GHL custom field name→ID mapping",
      },
      { onConflict: "setting_key" }
    );

    fieldCache = map;
    cacheTimestamp = Date.now();
    console.log(`Cached ${map.size} GHL custom field mappings`);
    return map;
  } catch (err) {
    console.error("Error fetching GHL custom fields:", err);
    fieldCache = new Map();
    cacheTimestamp = Date.now();
    return fieldCache;
  }
}

/**
 * Force refresh the field cache.
 * Call after creating new custom fields in GHL.
 */
export async function refreshFieldCache(): Promise<void> {
  fieldCache = null;
  cacheTimestamp = 0;
  await getFieldCache();
}

/**
 * Create a custom field in GHL if it doesn't already exist.
 * Returns the field ID (existing or newly created).
 */
export async function ensureCustomField(params: {
  name: string;
  dataType: "TEXT" | "NUMBER" | "DATE" | "CHECKBOX" | "LIST";
  options?: string[];
}): Promise<string> {
  const cache = await getFieldCache();
  const existing = cache.get(params.name.toLowerCase());
  if (existing) return existing;

  const locationId = process.env.GHL_LOCATION_ID;
  const apiKey = process.env.GHL_API_KEY;

  if (!locationId || !apiKey) {
    throw new Error("GHL credentials not configured");
  }

  const body: Record<string, unknown> = {
    name: params.name,
    dataType: params.dataType,
    model: "contact",
  };

  if (params.options) {
    body.picklistOptions = params.options;
  }

  const response = await fetch(
    `https://services.leadconnectorhq.com/locations/${locationId}/customFields`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create custom field "${params.name}": ${errText}`);
  }

  const data = await response.json() as { customField: GHLFieldDefinition };
  const fieldId = data.customField.id;

  // Update cache
  cache.set(params.name.toLowerCase(), fieldId);
  cacheTimestamp = Date.now();

  // Refresh full cache to persist
  await refreshFieldCache();

  return fieldId;
}
