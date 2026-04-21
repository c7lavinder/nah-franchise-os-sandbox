export const dynamic = "force-dynamic";

/**
 * POST /api/calls/create — manual call entry
 * Creates a call record from user input (title, contact, call type, date, notes).
 *
 * When the user explicitly picks a call type from the dropdown, that choice
 * wins. When they leave it blank, the shared classifyCallType helper fills
 * in the best match based on the other inputs.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { classifyCallType } from "@/lib/calls/classify-type";
import { resolveCallTypeBySlug } from "@/lib/calls/resolve-call-type";

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

  let finalCallTypeId: string | null = null;
  let classificationReason: string;

  if (call_type_id) {
    // User override — respect the dropdown choice.
    finalCallTypeId = call_type_id;
    classificationReason = "manually selected by user";
  } else {
    // Gather signals for the classifier.
    let hostEmail: string | null = null;
    if (hosted_by_user_id) {
      const { data: hostUser } = await supabase
        .from("users")
        .select("email")
        .eq("id", hosted_by_user_id)
        .maybeSingle();
      hostEmail = hostUser?.email ?? null;
    }

    let hasTerritoryOwner = false;
    if (contact_id) {
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
        hasTerritoryOwner = !!owner;
      }
    }

    const classification = classifyCallType({
      title: title.trim(),
      nah_emails: hostEmail ? [hostEmail] : [],
      is_internal: false,
      has_external_participant: !!contact_id,
      has_territory_owner: hasTerritoryOwner,
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
      contact_id: contact_id || null,
      call_type_id: finalCallTypeId,
      classification_reason: classificationReason,
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
