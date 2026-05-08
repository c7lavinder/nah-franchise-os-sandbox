/**
 * Scout prompt loader — reads editable prompt sections from app_settings.
 * Falls back to hardcoded defaults when DB values are NULL or on error.
 *
 * Sections stored in app_settings:
 *   scout_identity       — persona, tone, core rules
 *   scout_rules          — absolute rules (DRC, no fabrication, etc.)
 *   scout_profile_context — profile schema + scoring reference
 */

import { createServerClient } from "@/lib/supabase/server";

// Cache for 60 seconds to avoid hitting DB on every Scout turn
let cache: { data: Map<string, string>; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Load a prompt section from app_settings, falling back to the provided default.
 */
export async function loadPromptSection(key: string, defaultValue: string): Promise<string> {
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
      .in("setting_key", ["scout_identity", "scout_rules", "scout_profile_context"]);

    const map = new Map<string, string>();
    for (const row of rows ?? []) {
      const r = row as { setting_key: string; setting_value: string | null };
      if (r.setting_value) {
        map.set(r.setting_key, r.setting_value);
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
