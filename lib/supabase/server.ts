/**
 * Supabase server client for API routes (uses service role key, bypasses RLS).
 *
 * Client is intentionally untyped (no Database<> generic) because the codebase
 * has 473 type mismatches when strict typing is enabled. Gradual migration
 * tracked as Tier 1 follow-up. types/supabase.ts has full schema + relationship
 * types available for opt-in per-file typing.
 *
 * Regen: npx supabase gen types typescript --project-id llnrvophuvrqcqducgrr > types/supabase.ts
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
    global: {
      fetch: (url, options = {}) =>
        fetch(url, { ...options, cache: "no-store" }),
    },
  });
}
