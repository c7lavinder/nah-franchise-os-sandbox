export const dynamic = "force-dynamic";

/**
 * POST /api/calls/[callId]/override — manual reassignment.
 *
 * Used by the Reclassify / Reassign UI on the call detail page. Writes the
 * acting user's email + timestamp into classification_reason / match_reason
 * so the override is auditable downstream.
 *
 * Accepts:
 *   call_type_id          — new call type
 *   contact_id            — new primary contact for the call
 *   territory_ms_slug     — new primary territory for the call
 *   participants          — per-row call_participants updates
 *     [{ id, contact_id }]  contact_id can be null to unmap
 *
 * Access: admin, or the rep who owns the call (hosted_by_user_id).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";

interface ParticipantUpdate {
  id: string;
  contact_id: string | null;
}

interface OverrideBody {
  call_type_id?: string | null;
  contact_id?: string | null;
  territory_ms_slug?: string | null;
  participants?: ParticipantUpdate[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;
  const supabase = createServerClient();

  const authUser = await getAuthUser(
    request.headers.get("authorization") ?? request.headers.get("Authorization"),
  );
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: call, error: loadErr } = await supabase
    .from("calls")
    .select("id, hosted_by_user_id")
    .eq("id", callId)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const isAdmin = authUser.role === "admin";
  const isOwner = call.hosted_by_user_id === authUser.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as OverrideBody;
  const { call_type_id, contact_id, territory_ms_slug, participants } = body;

  const hasCallTypeChange = call_type_id !== undefined;
  const hasContactChange = contact_id !== undefined;
  const hasTerritoryChange = territory_ms_slug !== undefined;
  const hasParticipantUpdates = Array.isArray(participants) && participants.length > 0;

  if (!hasCallTypeChange && !hasContactChange && !hasTerritoryChange && !hasParticipantUpdates) {
    return NextResponse.json({ error: "No override fields provided" }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const audit = `manual override by ${authUser.email} at ${timestamp}`;

  // ── Participant updates: change contact_id (and derive role/territory).
  let participantsUpdated = 0;
  if (hasParticipantUpdates) {
    for (const p of participants!) {
      if (!p.id) continue;

      // Validate the participant belongs to this call before touching it.
      const { data: existing } = await supabase
        .from("call_participants")
        .select("id, email")
        .eq("id", p.id)
        .eq("call_id", callId)
        .maybeSingle();
      if (!existing) continue;

      const updates: Record<string, unknown> = { contact_id: p.contact_id };

      if (p.contact_id) {
        // Derive role + display name from the target contact.
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, ghl_contact_id, first_name, last_name")
          .eq("id", p.contact_id)
          .maybeSingle();
        if (contact) {
          const display = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
          if (display) updates.display_name = display;

          if (contact.ghl_contact_id) {
            const { data: owner } = await supabase
              .from("territory_owners")
              .select("ms_slug")
              .eq("ghl_contact_id", contact.ghl_contact_id)
              .is("end_date", null)
              .maybeSingle();
            updates.role = owner ? "franchisee" : "prospect";
          } else {
            updates.role = "prospect";
          }
        }
      } else {
        // Unmap — reset to unknown.
        updates.role = "unknown";
      }

      await supabase.from("call_participants").update(updates).eq("id", p.id);
      participantsUpdated++;
    }
  }

  // ── Call-level updates.
  const callUpdates: Record<string, unknown> = {};

  if (hasCallTypeChange) {
    callUpdates.call_type_id = call_type_id;
    callUpdates.classification_reason = audit;
  }

  if (hasContactChange || hasTerritoryChange || hasParticipantUpdates) {
    if (hasContactChange) callUpdates.contact_id = contact_id;
    if (hasTerritoryChange) callUpdates.territory_ms_slug = territory_ms_slug;
    // Any of these three imply a human-confirmed match.
    callUpdates.match_confidence = 1.0;
    callUpdates.match_reason = audit;
  }

  if (Object.keys(callUpdates).length > 0) {
    const { error: updateErr } = await supabase
      .from("calls")
      .update(callUpdates)
      .eq("id", callId);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    participantsUpdated,
    callUpdates,
  });
}
