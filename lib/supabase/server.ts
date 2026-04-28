/**
 * Supabase server client for API routes (uses service role key, bypasses RLS).
 *
 * NOTE: Client is intentionally untyped. Full typing requires `npx supabase login`
 * + `npx supabase gen types typescript --project-id llnrvophuvrqcqducgrr > types/supabase.ts`
 * which generates relationship metadata for join queries. The current types/supabase.ts
 * is a schema reference generated from the REST API (no relationship info).
 * See types/supabase.ts for table-level type reference.
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
