/**
 * Shared helper — inserts call_participants rows and updates call territory if franchisee found.
 * Idempotent: skips participants that already exist for this call.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ResolvedParticipant } from "../classifier";

export async function insertCallParticipants(callId: string, resolved: ResolvedParticipant[]): Promise<void> {
  if (resolved.length === 0) return;

  const supabase = createServerClient();

  // Check for existing participants to prevent duplicates on replay
  const { data: existing } = await supabase.from("call_participants").select("email").eq("call_id", callId);

  const existingEmails = new Set((existing ?? []).map((p) => p.email?.toLowerCase()));

  const newRows = resolved
    .filter((p) => !existingEmails.has(p.email?.toLowerCase()))
    .map((p) => ({
      call_id: callId,
      user_id: p.user_id ?? null,
      contact_id: p.contact_id ?? null,
      role: p.role,
      display_name: p.display_name,
      email: p.email,
      journey_pipeline_state_id: p.journey_pipeline_state_id ?? null,
    }));

  if (newRows.length > 0) {
    const { error } = await supabase.from("call_participants").insert(newRows);
    if (error) {
      console.error(`[insert-participants] callId=${callId} insert failed:`, error.message);
    }
  }

  if (existing && existing.length > 0 && newRows.length === 0) {
    console.warn(
      `[insert-participants] callId=${callId} all ${resolved.length} participants already exist — skipping (idempotent)`
    );
  }

  // Update call territory if a franchisee participant has one
  const franchisee = resolved.find((p) => p.role === "franchisee" && p.TerritorySlug);
  if (franchisee?.TerritorySlug) {
    await supabase.from("calls").update({ TerritorySlug: franchisee.TerritorySlug }).eq("id", callId);
  }
}
