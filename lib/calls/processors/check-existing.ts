/**
 * Shared idempotency guard — returns true if a call already exists for the
 * given Read.ai session. Used by every webhook processor to swallow retries
 * and duplicate webhook fires without inserting a second call row.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function callAlreadyExistsForReadAiSession(
  supabase: SupabaseClient,
  sessionId: string | null | undefined,
): Promise<boolean> {
  if (!sessionId) return false;
  const { data } = await supabase
    .from("calls")
    .select("id")
    .eq("read_ai_session_id", sessionId)
    .is("deleted_at", null)
    .maybeSingle();
  return !!data;
}
