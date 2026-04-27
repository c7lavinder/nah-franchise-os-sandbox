export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/[contactId]/merge
 *
 * Marks the contactId in the path as a duplicate of the keepContactId in
 * the body. We do NOT delete the duplicate row — too many foreign keys
 * point at it across calls, scout_action_logs, etc. Instead:
 *
 *   1. Reassign the user-visible references to the keeper:
 *        - calls.contact_id
 *        - contact_emails.contact_id (only emails not already on keeper)
 *        - journey_contacts.contact_id (re-link active memberships)
 *   2. Set merged_into_contact_id + merged_at on the duplicate.
 *   3. In GHL: add a note on the keeper + tag the duplicate as merged.
 *
 * The endpoint accepts either the local UUID or the GHL ID for both
 * sides. Returns a per-step success summary so the UI can surface what
 * actually moved vs. what was skipped.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

interface MergeBody {
  keepContactId: string;
  reason?: string;
}

interface StepResult {
  step: string;
  ok: boolean;
  detail?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { contactId: string } },
) {
  const dupRaw = params.contactId;
  const body = (await request.json()) as MergeBody;
  if (!body.keepContactId) {
    return NextResponse.json({ error: "keepContactId is required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const dupLocalId = await resolveContactId(dupRaw);
  const keepLocalId = await resolveContactId(body.keepContactId);
  if (!dupLocalId || !keepLocalId) {
    return NextResponse.json({ error: "One or both contacts not found" }, { status: 404 });
  }
  if (dupLocalId === keepLocalId) {
    return NextResponse.json({ error: "Cannot merge a contact into itself" }, { status: 400 });
  }

  const steps: StepResult[] = [];

  // Pull both rows once for GHL ops + naming
  const { data: bothRows } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id, first_name, last_name, email")
    .in("id", [dupLocalId, keepLocalId]);

  const dup = bothRows?.find((r) => r.id === dupLocalId);
  const keep = bothRows?.find((r) => r.id === keepLocalId);
  const dupName = `${dup?.first_name ?? ""} ${dup?.last_name ?? ""}`.trim() || dup?.email || "duplicate contact";
  const keepName = `${keep?.first_name ?? ""} ${keep?.last_name ?? ""}`.trim() || keep?.email || "kept contact";

  // 1. Reassign calls
  try {
    const { data, error } = await supabase
      .from("calls")
      .update({ contact_id: keepLocalId })
      .eq("contact_id", dupLocalId)
      .select("id");
    if (error) throw new Error(error.message);
    steps.push({ step: "calls", ok: true, detail: `${(data ?? []).length} reassigned` });
  } catch (err) {
    steps.push({ step: "calls", ok: false, detail: err instanceof Error ? err.message : "failed" });
  }

  // 2. Move emails the keeper doesn't already have. Drop the rest so the
  //    partial-unique index on (contact_id, email) doesn't fire when both
  //    sides happen to share an address.
  try {
    const { data: keepEmails } = await supabase
      .from("contact_emails")
      .select("email")
      .eq("contact_id", keepLocalId);
    const existing = new Set((keepEmails ?? []).map((r) => r.email));

    const { data: dupEmails } = await supabase
      .from("contact_emails")
      .select("id, email, is_primary, label, source")
      .eq("contact_id", dupLocalId);

    let moved = 0;
    let dropped = 0;
    for (const row of dupEmails ?? []) {
      if (existing.has(row.email)) {
        await supabase.from("contact_emails").delete().eq("id", row.id);
        dropped++;
      } else {
        // Force is_primary false on transfer — keeper's primary stays primary
        await supabase
          .from("contact_emails")
          .update({ contact_id: keepLocalId, is_primary: false })
          .eq("id", row.id);
        moved++;
      }
    }
    steps.push({ step: "emails", ok: true, detail: `${moved} moved, ${dropped} dropped (already on keeper)` });
  } catch (err) {
    steps.push({ step: "emails", ok: false, detail: err instanceof Error ? err.message : "failed" });
  }

  // 3. Active journey memberships — close the dup's, leave the keeper's.
  //    We do NOT re-link memberships across journeys; that's a manual
  //    decision the user makes per case. Soft-close by stamping left_at.
  try {
    const { data, error } = await supabase
      .from("journey_contacts")
      .update({ left_at: new Date().toISOString(), role_notes: "auto-closed by merge" })
      .eq("contact_id", dupLocalId)
      .is("left_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    steps.push({ step: "journey_memberships", ok: true, detail: `${(data ?? []).length} closed` });
  } catch (err) {
    steps.push({ step: "journey_memberships", ok: false, detail: err instanceof Error ? err.message : "failed" });
  }

  // 4. Mark the duplicate
  try {
    const { error } = await supabase
      .from("contacts")
      .update({
        merged_into_contact_id: keepLocalId,
        merged_at: new Date().toISOString(),
      })
      .eq("id", dupLocalId);
    if (error) throw new Error(error.message);
    steps.push({ step: "mark_merged", ok: true });
  } catch (err) {
    steps.push({ step: "mark_merged", ok: false, detail: err instanceof Error ? err.message : "failed" });
  }

  // 5. GHL: add a note on the keeper documenting the merge + tag the dup.
  if (keep?.ghl_contact_id) {
    try {
      const noteBody = `Merged ${dupName} into this contact${body.reason ? ` — ${body.reason}` : ""}. (${new Date().toLocaleString()})`;
      await ghl.addNote(keep.ghl_contact_id, noteBody);
      steps.push({ step: "ghl_keeper_note", ok: true });
    } catch (err) {
      steps.push({ step: "ghl_keeper_note", ok: false, detail: err instanceof Error ? err.message : "failed" });
    }
  }

  if (dup?.ghl_contact_id) {
    try {
      await ghl.updateContact(dup.ghl_contact_id, {
        tags: [`merged-into:${keepLocalId}`, "duplicate-merged"],
      });
      steps.push({ step: "ghl_dup_tag", ok: true });
    } catch (err) {
      steps.push({ step: "ghl_dup_tag", ok: false, detail: err instanceof Error ? err.message : "failed" });
    }
  }

  return NextResponse.json({
    success: steps.every((s) => s.ok || s.step === "ghl_keeper_note" || s.step === "ghl_dup_tag"),
    duplicate: { id: dupLocalId, name: dupName },
    keeper: { id: keepLocalId, name: keepName },
    steps,
  });
}
