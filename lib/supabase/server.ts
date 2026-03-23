/**
 * Supabase server client for API routes (uses service role key, bypasses RLS).
 *
 * NOTE: Using untyped client until schema is deployed and we generate types
 * with `supabase gen types typescript`. The Database type in types/database.ts
 * documents the expected schema for reference.
 */

import { createClient } from "@supabase/supabase-js";

/** Creates a Supabase client with service role privileges for server-side use */
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
  });
}
