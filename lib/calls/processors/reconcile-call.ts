/**
 * Lightweight single-call reconciliation — runs immediately after
 * insertCallParticipants and as a safety net for contacts that were created
 * AFTER the call's webhook arrived.
 *
 * Delegates to the shared participant resolver; only writes to rows that are
 * still missing contact_id / territory_ms_slug so we never clobber a prior
 * higher-signal match.
 */

import { createServerClient } from "@/lib/supabase/server";
import {
  resolveCallParticipants,
  createSupabaseResolverDb,
  type ParticipantSignal,
} from "../resolve-participants";
import { upsertCallJunctions } from "./upsert-call-junctions";

export async function reconcileCall(callId: string): Promise<void> {
  const supabase = createServerClient();

  const { data: orphans } = await supabase
    .from("call_participants")
    .select("id, email, display_name, contact_id, user_id")
    .eq("call_id", callId)
    .is("contact_id", null)
    .is("user_id", null);

  if (!orphans || orphans.length === 0) return;

  const signals: ParticipantSignal[] = orphans.map((p) => ({
    email: p.email,
    name: p.display_name,
    phone: null,
  }));

  const db = createSupabaseResolverDb(supabase);
  const result = await resolveCallParticipants(
    { participants: signals, meeting_title: null, source: "read_ai" },
    db,
  );

  // Update participant rows whose signal now resolves.
  for (let i = 0; i < orphans.length; i++) {
    const orphan = orphans[i];
    const resolved = result.participants[i];
    const updates: Record<string, unknown> = {};

    if (resolved.role === "nah_team") {
      if (resolved.user_id) updates.user_id = resolved.user_id;
      updates.role = "nah_team";
      if (!orphan.display_name || orphan.display_name.includes("@")) {
        updates.display_name = resolved.display_name;
      }
    } else if (resolved.contact_id) {
      updates.contact_id = resolved.contact_id;
      updates.role = resolved.role;
      if (!orphan.display_name || orphan.display_name.includes("@")) {
        updates.display_name = resolved.display_name;
      }
      if (resolved.journey_pipeline_state_id) {
        updates.journey_pipeline_state_id = resolved.journey_pipeline_state_id;
      }
    } else if (orphan.display_name?.includes("@")) {
      updates.display_name = resolved.display_name;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("call_participants").update(updates).eq("id", orphan.id);
    }
  }

  // Call-level update — only fill in if still null on the row.
  if (result.contact_id || result.territory_ms_slug || result.journey_pipeline_state_id) {
    const { data: call } = await supabase
      .from("calls")
      .select("contact_id, territory_ms_slug, journey_pipeline_state_id")
      .eq("id", callId)
      .single();
    if (call) {
      const callUpdates: Record<string, unknown> = {};
      if (!call.contact_id && result.contact_id) callUpdates.contact_id = result.contact_id;
      if (!call.territory_ms_slug && result.territory_ms_slug) callUpdates.territory_ms_slug = result.territory_ms_slug;
      if (!call.journey_pipeline_state_id && result.journey_pipeline_state_id) {
        callUpdates.journey_pipeline_state_id = result.journey_pipeline_state_id;
      }
      if (Object.keys(callUpdates).length > 0) {
        callUpdates.match_confidence = result.confidence;
        callUpdates.match_reason = result.reason;
        await supabase.from("calls").update(callUpdates).eq("id", callId);
      }
    }
  }

  // Finally, make sure every territory/journey seen by the resolver is
  // attached to the call — upsert is idempotent so this is safe on re-runs.
  await upsertCallJunctions(supabase, callId, result);
}
