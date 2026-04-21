export const dynamic = "force-dynamic";

/**
 * POST /api/calls/create — manual call entry.
 *
 * When the rep explicitly picks a call type or a contact from the dropdown,
 * that choice wins. When they leave a field blank, the shared resolver fills
 * it in based on whatever signals we have.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { classifyCallType } from "@/lib/calls/classify-type";
import { resolveCallTypeBySlug } from "@/lib/calls/resolve-call-type";
import {
  resolveCallParticipants,
  createSupabaseResolverDb,
  type ParticipantSignal,
} from "@/lib/calls/resolve-participants";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  const body = await request.json();
  const {
    title,
    contact_id,
    call_type_id,
    hosted_by_user_id,
    scheduled_at,
    started_at,
    duration_minutes,
    notes,
  } = body as {
    title?: string;
    contact_id?: string;
    call_type_id?: string;
    hosted_by_user_id?: string;
    scheduled_at?: string;
    started_at?: string;
    duration_minutes?: number;
    notes?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const durationSeconds = duration_minutes ? duration_minutes * 60 : null;

  // ─── Resolve contact / territory ────────────────────────────────────────
  let finalContactId: string | null = null;
  let finalTerritorySlug: string | null = null;
  let matchConfidence = 0;
  let matchReason = "no signals matched";

  if (contact_id) {
    finalContactId = contact_id;
    matchConfidence = 1.0;
    matchReason = "manually selected by user";

    // If the user picked a contact, still fetch their territory so downstream
    // coaching logic works without the user having to enter it.
    const { data: contact } = await supabase
      .from("contacts")
      .select("ghl_contact_id")
      .eq("id", contact_id)
      .maybeSingle();
    if (contact?.ghl_contact_id) {
      const { data: owner } = await supabase
        .from("territory_owners")
        .select("ms_slug")
        .eq("ghl_contact_id", contact.ghl_contact_id)
        .is("end_date", null)
        .maybeSingle();
      finalTerritorySlug = owner?.ms_slug ?? null;
    }
  } else {
    // No user override — ask the resolver with what little we have.
    const signals: ParticipantSignal[] = [];
    if (hosted_by_user_id) {
      const { data: hostUser } = await supabase
        .from("users")
        .select("email")
        .eq("id", hosted_by_user_id)
        .maybeSingle();
      if (hostUser?.email) signals.push({ email: hostUser.email });
    }
    const resolverDb = createSupabaseResolverDb(supabase);
    const match = await resolveCallParticipants(
      { participants: signals, meeting_title: title.trim(), source: "manual" },
      resolverDb,
    );
    finalContactId = match.contact_id;
    finalTerritorySlug = match.territory_ms_slug;
    matchConfidence = match.confidence;
    matchReason = match.reason;
  }

  // ─── Resolve call type ──────────────────────────────────────────────────
  let finalCallTypeId: string | null = null;
  let classificationReason: string;

  if (call_type_id) {
    finalCallTypeId = call_type_id;
    classificationReason = "manually selected by user";
  } else {
    let hostEmail: string | null = null;
    if (hosted_by_user_id) {
      const { data: hostUser } = await supabase
        .from("users")
        .select("email")
        .eq("id", hosted_by_user_id)
        .maybeSingle();
      hostEmail = hostUser?.email ?? null;
    }

    const classification = classifyCallType({
      title: title.trim(),
      nah_emails: hostEmail ? [hostEmail] : [],
      is_internal: false,
      has_external_participant: !!finalContactId,
      has_territory_owner: !!finalTerritorySlug,
      source: "manual",
    });
    const resolved = await resolveCallTypeBySlug(supabase, classification.slug);
    finalCallTypeId = resolved.id;
    classificationReason = classification.reason;
  }

  const { data: call, error } = await supabase
    .from("calls")
    .insert({
      title: title.trim(),
      contact_id: finalContactId,
      territory_ms_slug: finalTerritorySlug,
      call_type_id: finalCallTypeId,
      classification_reason: classificationReason,
      match_confidence: matchConfidence,
      match_reason: matchReason,
      hosted_by_user_id: hosted_by_user_id || null,
      scheduled_at: scheduled_at || null,
      started_at: started_at || null,
      duration_seconds: durationSeconds,
      summary: notes?.trim() || null,
      source: "manual",
      status: "completed",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: call.id, success: true });
}
