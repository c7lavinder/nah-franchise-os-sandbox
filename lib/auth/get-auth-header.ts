/**
 * Client-side helper — returns the Authorization header value for API calls.
 * Reads the current Supabase session token from the browser client.
 * Returns null if no session is active.
 *
 * Usage (frontend fetch calls):
 *   const authHeader = await getAuthHeader();
 *   fetch('/api/foo', { headers: authHeader ? { Authorization: authHeader } : {} });
 */

import { supabase } from "@/lib/supabase/client";

export async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return `Bearer ${session.access_token}`;
}
