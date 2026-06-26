/**
 * POST /api/journeys/:journeyId/merge
 *
 * Merge another journey INTO this one. This journey survives; the source
 * journey is closed. All contacts, pipeline states, and call links from
 * the source are moved to this journey.
 *
 * Body: { source_journey_id: string }
 *
 * Use case: Business partners (Courtney + Michael) who each got their own
 * journey but should share one.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ journeyId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { journeyId: targetId } = await params;
  const body = (await request.json().catch(() => ({}))) as { source_journey_id?: string };
  const sourceId = body.source_journey_id?.trim();

  if (!sourceId) {
    return NextResponse.json({ error: "source_journey_id is required" }, { status: 400 });
  }
  if (sourceId === targetId) {
    return NextResponse.json({ error: "Cannot merge a journey into itself" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Verify both journeys exist
  const [{ data: target }, { data: source }] = await Promise.all([
    supabase.from("journeys").select("id, name, status").eq("id", targetId).maybeSingle(),
    supabase.from("journeys").select("id, name, status").eq("id", sourceId).maybeSingle(),
  ]);

  if (!target) return NextResponse.json({ error: "Target journey not found" }, { status: 404 });
  if (!source) return NextResponse.json({ error: "Source journey not found" }, { status: 404 });

  // 1. Move contacts from source → target (skip duplicates)
  const { data: sourceContacts } = await supabase
    .from("journey_contacts")
    .select("id, contact_id, role, role_notes")
    .eq("journey_id", sourceId)
    .is("left_at", null);

  const { data: targetContacts } = await supabase
    .from("journey_contacts")
    .select("contact_id")
    .eq("journey_id", targetId)
    .is("left_at", null);

  const existingContactIds = new Set((targetContacts ?? []).map((c) => c.contact_id));

  for (const sc of sourceContacts ?? []) {
    if (existingContactIds.has(sc.contact_id)) {
      // Already on target — just close the source membership
      await supabase.from("journey_contacts").update({ left_at: new Date().toISOString() }).eq("id", sc.id);
    } else {
      // Move to target as co_primary (they're joining an existing journey)
      await supabase.from("journey_contacts").update({ journey_id: targetId, role: "co_primary" }).eq("id", sc.id);
    }
  }

  // 2. Move pipeline state rows — re-point to target journey.
  // Skip rows where target already has a row in the same pipeline.
  const { data: sourceJps } = await supabase
    .from("journey_pipeline_state")
    .select("id, pipeline_id")
    .eq("journey_id", sourceId)
    .eq("is_active", true);

  const { data: targetJps } = await supabase
    .from("journey_pipeline_state")
    .select("pipeline_id")
    .eq("journey_id", targetId)
    .eq("is_active", true);

  const targetPipelines = new Set((targetJps ?? []).map((j) => j.pipeline_id));

  for (const sj of sourceJps ?? []) {
    if (targetPipelines.has(sj.pipeline_id)) {
      // Target already has this pipeline — deactivate source row
      await supabase.from("journey_pipeline_state").update({ is_active: false }).eq("id", sj.id);
    } else {
      // Move to target
      await supabase.from("journey_pipeline_state").update({ journey_id: targetId }).eq("id", sj.id);
    }
  }

  // 3. Move call_journeys references
  await supabase.from("call_journeys").update({ journey_id: targetId }).eq("journey_id", sourceId);

  // 4. Close the source journey. NOTE: journeys.status only allows
  //    'active' | 'archived' | 'closed' (see journeys_schema migration) —
  //    'merged' violates the CHECK constraint and threw on every merge.
  await supabase
    .from("journeys")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", sourceId);

  // 5. Rebuild target journey name from all active primaries/co_primaries
  const { data: allPrimaries } = await supabase
    .from("journey_contacts")
    .select("contacts(first_name, last_name)")
    .eq("journey_id", targetId)
    .is("left_at", null)
    .in("role", ["primary", "co_primary"]);

  const names: string[] = [];
  for (const m of allPrimaries ?? []) {
    const c = Array.isArray(m.contacts) ? m.contacts[0] : m.contacts;
    const full =
      `${(c as { first_name?: string })?.first_name ?? ""} ${(c as { last_name?: string })?.last_name ?? ""}`.trim();
    if (full && !names.includes(full)) names.push(full);
  }
  if (names.length > 0) {
    await supabase
      .from("journeys")
      .update({ name: names.join(" + "), updated_at: new Date().toISOString() })
      .eq("id", targetId);
  }

  return NextResponse.json({
    merged: true,
    target_journey_id: targetId,
    source_journey_id: sourceId,
    new_name: names.join(" + ") || target.name,
    contacts_moved: (sourceContacts ?? []).filter((c) => !existingContactIds.has(c.contact_id)).length,
    contacts_already_present: (sourceContacts ?? []).filter((c) => existingContactIds.has(c.contact_id)).length,
  });
}
