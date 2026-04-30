/**
 * Supabase server client for API routes (uses service role key, bypasses RLS).
 *
 * The client is untyped by default — adding Database<> generics produces ~70 errors
 * because some queries use columns/tables that need migration alignment. The
 * auto-generated types in types/supabase.ts are fresh (regenerated 2026-04-30)
 * and can be used for opt-in per-query typing via the typed() helper below.
 *
 * Regen: npx supabase gen types typescript --project-id llnrvophuvrqcqducgrr > types/supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;

/** Creates an untyped Supabase client with service role privileges */
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
  });
}

/** Creates a fully typed Supabase client — use for new code that wants compile-time safety */
export function createTypedServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }
  if (!supabaseServiceKey) {
    throw new Error("Missing SUPABASE_SERVICE_KEY environment variable");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
    },
  });
}
