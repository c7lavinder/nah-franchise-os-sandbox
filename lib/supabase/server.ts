/**
 * Supabase server client for API routes (uses service role key, bypasses RLS).
 *
 * The client is untyped — adding Database<> generics produces ~168 errors
 * across 64 files (stale column references, join types, null handling).
 * Tracked for a dedicated cleanup session.
 *
 * Auto-generated types in types/supabase.ts are fresh (2026-06-03).
 * Regen: npx supabase gen types typescript --project-id llnrvophuvrqcqducgrr > types/supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

export type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;

/** Creates a Supabase client with service role privileges */
export function createServerClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_KEY");

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
    },
    realtime: { transport: require("ws") },
  });
}

/**
 * Typed Supabase client for new/refactored modules.
 *
 * Keep legacy `createServerClient()` untyped until stale-column debt is burned
 * down; use this helper for new code and small domain migrations.
 */
export function createTypedServerClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_KEY");

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
    },
    realtime: { transport: require("ws") },
  });
}
