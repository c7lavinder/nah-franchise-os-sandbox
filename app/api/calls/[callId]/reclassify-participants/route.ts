export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/reclassify-participants
 *
 * Re-runs the participant resolver against the CURRENT team-email + users list
 * for an already-processed call. Useful when:
 *   - A team member is added after the call was first processed (e.g. Rylyn /
 *     Sam) — their `unknown` role gets corrected to `nah_team`.
 *   - A new contact is created after the call (e.g. via the Reassign modal's
 *     "Add prospect" flow) — name-only participants get linked to the new
 *     contact.
 *
 * Only updates rows where the role changes (so existing rep-applied mappings
 * via the Reassign modal — contact_id, journey_pipeline_state_id — are
 * preserved).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveCallParticipants, createSupabaseResolverDb } from "@/lib/calls/resolve-participants";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const supabase = createServerClient();

  // Pull current participant rows so we can map updates back by email/display.
  const { data: existing } = await supabase
    .from("call_participants")
    .select("id, email, display_name, role, contact_id, user_id")
    .eq("call_id", callId);

  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: "No participants on this call" }, { status: 404 });
  }

  // Pull call metadata for the resolver shape (meeting_title + source).
  const { data: call } = await supabase
    .from("calls")
    .select("title, source")
    .eq("id", callId)
    .single();

  // Re-run the resolver against the original participant inputs (email, name).
  const validSources = new Set(["read_ai", "ghl_calendar", "manual"] as const);
  const source: "read_ai" | "ghl_calendar" | "manual" =
    call?.source && (validSources as Set<string>).has(call.source) ? (call.source as "read_ai" | "ghl_calendar" | "manual") : "manual";
  const resolverInput = {
    participants: existing.map((p) => ({ email: p.email, name: p.display_name })),
    meeting_title: call?.title ?? null,
    source,
  };
  const db = createSupabaseResolverDb(supabase);
  const result = await resolveCallParticipants(resolverInput, db);

  let updated = 0;
  let promotedToTeam = 0;
  let resolvedToContact = 0;

  for (let i = 0; i < existing.length; i++) {
    const before = existing[i];
    const after = result.participants[i];
    if (!after) continue;

    const updates: Record<string, unknown> = {};

    // Role change (most common: unknown → nah_team after team list grew, or
    // unknown → prospect/franchisee after a contact was created).
    if (after.role !== before.role) {
      updates.role = after.role;
      if (after.role === "nah_team" && before.role !== "nah_team") promotedToTeam++;
    }

    // contact_id only set when the resolver finds a match AND the row doesn't
    // already have a (rep-applied) contact mapping. Don't clobber manual maps.
    if (!before.contact_id && after.contact_id) {
      updates.contact_id = after.contact_id;
      resolvedToContact++;
    }

    // user_id similarly — only fill it in when missing.
    if (!before.user_id && after.user_id) {
      updates.user_id = after.user_id;
    }

    // Use cleaned display name if the resolver came up with a better one.
    if (after.display_name && after.display_name !== before.display_name) {
      updates.display_name = after.display_name;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("call_participants").update(updates).eq("id", before.id);
      updated++;
    }
  }

  return NextResponse.json({
    success: true,
    total: existing.length,
    updated,
    promotedToTeam,
    resolvedToContact,
  });
}
