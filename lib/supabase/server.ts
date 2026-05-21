/**
 * Supabase server client for API routes (uses service role key, bypasses RLS).
 *
 * The client is untyped — adding Database<> generics produces ~168 errors
 * across 64 files (stale column references, join types, null handling).
 * Tracked for a dedicated cleanup session.
 *
 * Auto-generated types in types/supabase.ts are fresh (2026-04-30).
 * Regen: npx supabase gen types typescript --project-id llnrvophuvrqcqducgrr > types/supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;

/** Creates a Supabase client with service role privileges */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }
  if (!supabaseServiceKey) {
    throw new Error("Missing SUPABASE_SERVICE_KEY environment variable");
  }

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
