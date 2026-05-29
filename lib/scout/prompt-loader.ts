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
import { createHash } from "node:crypto";

// Cache for 60 seconds to avoid hitting DB on every Scout turn
let cache: { data: Map<string, { value: string; updatedAt: string | null }>; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** Keys that are ALWAYS sourced from code — DB values are ignored */
const CODE_ONLY_KEYS = new Set(["scout_rules"]);

/** Prompt keys loaded from app_settings in a single cached query */
const PROMPT_SETTING_KEYS = ["scout_identity", "scout_profile_context", "scout_calendars"];

export type PromptBlockSource = "code" | "db" | "runtime";

export interface PromptBlockMetadata {
  key: string;
  source: PromptBlockSource;
  version: string;
  contentHash: string;
  charCount: number;
  updatedAt?: string | null;
}

export interface PromptSectionLoadResult {
  key: string;
  value: string;
  metadata: PromptBlockMetadata;
}

function hashPromptValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function createPromptBlockMetadata(
  key: string,
  value: string,
  source: PromptBlockSource,
  updatedAt?: string | null
): PromptBlockMetadata {
  const contentHash = hashPromptValue(value);
  return {
    key,
    source,
    version: `${source}:${updatedAt ?? contentHash}`,
    contentHash,
    charCount: value.length,
    updatedAt: updatedAt ?? null,
  };
}

export function createPromptVersion(blocks: PromptBlockMetadata[]): string {
  return hashPromptValue(
    JSON.stringify(
      blocks.map((block) => ({
        key: block.key,
        source: block.source,
        version: block.version,
        contentHash: block.contentHash,
      }))
    )
  );
}

/**
 * Load a prompt section from app_settings, falling back to the provided default.
 */
export async function loadPromptSection(key: string, defaultValue: string): Promise<string> {
  return (await loadPromptSectionWithMetadata(key, defaultValue)).value;
}

/**
 * Load a prompt section and return compact metadata for LLM logging.
 */
export async function loadPromptSectionWithMetadata(
  key: string,
  defaultValue: string
): Promise<PromptSectionLoadResult> {
  // scout_rules always uses the code constant — prevents stale DB overrides
  if (CODE_ONLY_KEYS.has(key)) {
    return {
      key,
      value: defaultValue,
      metadata: createPromptBlockMetadata(key, defaultValue, "code"),
    };
  }

  try {
    // Check cache
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      const cached = cache.data.get(key);
      if (cached?.value?.trim()) {
        return {
          key,
          value: cached.value,
          metadata: createPromptBlockMetadata(key, cached.value, "db", cached.updatedAt),
        };
      }
      return {
        key,
        value: defaultValue,
        metadata: createPromptBlockMetadata(key, defaultValue, "code"),
      };
    }

    // Load all scout prompt settings in one query
    const supabase = createServerClient();
    const { data: rows } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value, updated_at")
      .in("setting_key", PROMPT_SETTING_KEYS);

    const map = new Map<string, { value: string; updatedAt: string | null }>();
    for (const row of rows ?? []) {
      const r = row as { setting_key: string; setting_value: unknown; updated_at?: string | null };
      // setting_value is JSONB — could be a JSON string, object, or empty
      const val = typeof r.setting_value === "string" ? r.setting_value : "";
      map.set(r.setting_key, { value: val, updatedAt: r.updated_at ?? null });
    }
    cache = { data: map, ts: Date.now() };

    const loaded = map.get(key);
    if (loaded?.value?.trim()) {
      return {
        key,
        value: loaded.value,
        metadata: createPromptBlockMetadata(key, loaded.value, "db", loaded.updatedAt),
      };
    }

    return {
      key,
      value: defaultValue,
      metadata: createPromptBlockMetadata(key, defaultValue, "code"),
    };
  } catch {
    // On any error, use the hardcoded default
    return {
      key,
      value: defaultValue,
      metadata: createPromptBlockMetadata(key, defaultValue, "code"),
    };
  }
}

/** Clear the prompt cache (call after admin updates a setting) */
export function clearPromptCache(): void {
  cache = null;
}
