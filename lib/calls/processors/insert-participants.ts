/**
 * Shared helper — inserts call_participants rows and updates call territory if franchisee found.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ResolvedParticipant } from "../classifier";

export async function insertCallParticipants(
  callId: string,
  resolved: ResolvedParticipant[],
): Promise<void> {
  if (resolved.length === 0) return;

  const supabase = createServerClient();

  const rows = resolved.map((p) => ({
    call_id: callId,
    user_id: p.user_id ?? null,
    contact_id: p.contact_id ?? null,
    role: p.role,
    display_name: p.display_name,
    email: p.email,
  }));

  await supabase.from("call_participants").insert(rows);

  // Update call territory if a franchisee participant has one
  const franchisee = resolved.find((p) => p.role === "franchisee" && p.territory_ms_slug);
  if (franchisee?.territory_ms_slug) {
    await supabase
      .from("calls")
      .update({ territory_ms_slug: franchisee.territory_ms_slug })
      .eq("id", callId);
  }
}
