/**
 * Scout prompt loader — reads editable prompt sections from app_settings.
 * Falls back to hardcoded defaults when DB values are NULL or on error.
 *
 * Sections stored in app_settings:
 *   scout_identity       — persona, tone, core rules
 *   scout_profile_context — profile schema + scoring reference
 *   scout_calendars      — NAH GHL calendars and their business purpose
 *
 * scout_rules is ALWAYS sourced from code (not DB) to prevent stale overrides.
 */

import { createServerClient } from "@/lib/supabase/server";

// Cache for 60 seconds to avoid hitting DB on every Scout turn
let cache: { data: Map<string, string>; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** Keys that are ALWAYS sourced from code — DB values are ignored */
const CODE_ONLY_KEYS = new Set(["scout_rules"]);

/**
 * Load a prompt section from app_settings, falling back to the provided default.
 */
export async function loadPromptSection(key: string, defaultValue: string): Promise<string> {
  // scout_rules always uses the code constant — prevents stale DB overrides
  if (CODE_ONLY_KEYS.has(key)) return defaultValue;

  try {
    // Check cache
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      const cached = cache.data.get(key);
      if (cached !== undefined) return cached || defaultValue;
    }

    // Load all scout prompt settings in one query
    const supabase = createServerClient();
    const { data: rows } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["scout_identity", "scout_profile_context", "scout_calendars"]);

    const map = new Map<string, string>();
    for (const row of rows ?? []) {
      const r = row as { setting_key: string; setting_value: unknown };
      // setting_value is JSONB — could be a JSON string, object, or empty
      const val = typeof r.setting_value === "string" ? r.setting_value : "";
      if (val && val.trim()) {
        map.set(r.setting_key, val);
      }
    }
    cache = { data: map, ts: Date.now() };

    return map.get(key) || defaultValue;
  } catch {
    // On any error, use the hardcoded default
    return defaultValue;
  }
}

/** Clear the prompt cache (call after admin updates a setting) */
export function clearPromptCache(): void {
  cache = null;
}
