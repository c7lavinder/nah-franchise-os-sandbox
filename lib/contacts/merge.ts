/**
 * The contact merge — EXTRACTED from app/api/contacts/[contactId]/merge/route.ts so the
 * route and MasterSuite's replay (`merge_contact` in lib/mastersuite/apply-native-writes.ts)
 * run the SAME code. The walkthrough's Merge ×2 asked for exactly this: an extraction,
 * not a port — 3 of this logic's first 5 runs orphaned a journey when it lived only in
 * the route, and a second copy in C# would drift the same way.
 *
 * Behaviour is the route's, unchanged (including step 3b, the journey re-pointing added
 * 2026-08-08). The dup is MARKED (merged_into_contact_id), never deleted — too many
 * foreign keys point at it.
 */

import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

export interface MergeStepResult {
  step: string;
  ok: boolean;
  detail?: string;
}

export type MergeContactResult =
  | {
      ok: true;
      success: boolean;
      duplicate: { id: string; name: string };
      keeper: { id: string; name: string };
      steps: MergeStepResult[];
    }
  | { ok: false; error: string; status: number; alreadyMergedIntoKeeper?: boolean };

/**
 * Merge `dupRaw` into `keepRaw` (either side may be a local UUID or a GHL id).
 *
 * ⚠ Refuses when either side is already merged — EXCEPT when the dup is already merged
 * into this exact keeper, which the caller may treat as an idempotent no-op
 * (`alreadyMergedIntoKeeper`). That is what makes the replay safe to run twice.
 */
export async function mergeContact(dupRaw: string, keepRaw: string, reason?: string): Promise<MergeContactResult> {
  const supabase = createServerClient();

  const dupLocalId = await resolveContactId(dupRaw);
  const keepLocalId = await resolveContactId(keepRaw);
  if (!dupLocalId || !keepLocalId) {
    return { ok: false, error: "One or both contacts not found", status: 404 };
  }
  if (dupLocalId === keepLocalId) {
    return { ok: false, error: "Cannot merge a contact into itself", status: 400 };
  }

  const steps: MergeStepResult[] = [];

  // Pull both rows once for GHL ops + naming + already-merged checks
  const { data: bothRows } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id, first_name, last_name, email, merged_into_contact_id")
    .in("id", [dupLocalId, keepLocalId]);

  const dup = bothRows?.find((r) => r.id === dupLocalId);
  const keep = bothRows?.find((r) => r.id === keepLocalId);
  const dupName = `${dup?.first_name ?? ""} ${dup?.last_name ?? ""}`.trim() || dup?.email || "duplicate contact";
  const keepName = `${keep?.first_name ?? ""} ${keep?.last_name ?? ""}`.trim() || keep?.email || "kept contact";

  // Refuse to merge if either side is already merged. Lets us avoid
  // chains and lost-pointer surprises.
  if (dup?.merged_into_contact_id) {
    return {
      ok: false,
      error: `${dupName} is already merged into another contact.`,
      status: 409,
      alreadyMergedIntoKeeper: dup.merged_into_contact_id === keepLocalId,
    };
  }
  if (keep?.merged_into_contact_id) {
    return {
      ok: false,
      error: `${keepName} is itself a merged-out duplicate. Pick the canonical contact instead.`,
      status: 409,
    };
  }

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
    const { data: keepEmails } = await supabase.from("contact_emails").select("email").eq("contact_id", keepLocalId);
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
        await supabase.from("contact_emails").update({ contact_id: keepLocalId, is_primary: false }).eq("id", row.id);
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

  // 3b. journeys.primary_contact_id — the pointer that makes a journey REACHABLE.
  //
  //     ⚠ This step did not exist until 2026-08-08, and its absence is not
  //     theoretical: of the 5 merges this route had performed, 3 left a journey
  //     pointing at a contact that had just been marked merged-away. Measured on
  //     production Supabase. Every merge where the duplicate happened to be a
  //     journey's primary produced one.
  //
  //     Step 3 above closes MEMBERSHIPS (journey_contacts), which is a different
  //     column in a different table, and closing them is what made this look
  //     handled. A journey is found by its primary_contact_id; leave that on a
  //     merged-away contact and the journey still exists, still says "active",
  //     and is no longer reachable from the person it belongs to.
  //
  //     Repointing is right even when the keeper ALREADY has a journey. A person
  //     holding several journeys at once is legitimate here, not a corruption —
  //     NAH System holds four territory journeys and Jason Semper holds two, and
  //     the pipeline design says so explicitly. An unreachable journey is strictly
  //     worse than a second reachable one. The names are surfaced rather than just
  //     a count, because this moves someone's journey onto another record and the
  //     operator should see which.
  try {
    const { data, error } = await supabase
      .from("journeys")
      .update({ primary_contact_id: keepLocalId })
      .eq("primary_contact_id", dupLocalId)
      .select("id, name, status");
    if (error) throw new Error(error.message);
    const moved = data ?? [];
    steps.push({
      step: "journey_primary_contact",
      ok: true,
      detail: moved.length
        ? `${moved.length} repointed to ${keepName}: ${moved.map((j) => `"${j.name}" [${j.status}]`).join(", ")}`
        : "none pointed at the duplicate",
    });
  } catch (err) {
    steps.push({
      step: "journey_primary_contact",
      ok: false,
      detail: err instanceof Error ? err.message : "failed",
    });
  }

  // 4. Bulk reassign tables keyed by contact_id (UUID) with no
  //    uniqueness constraint. Fan out so one bad table doesn't block
  //    the rest; each row in the summary tells the user what moved.
  const BULK_CONTACT_TABLES: { table: string; column?: string; label?: string }[] = [
    { table: "call_logs" },
    { table: "call_action_items" },
    { table: "call_data_extractions" },
    { table: "candidate_score_history" },
    { table: "objection_registry" },
    { table: "contact_team_members" },
    { table: "contact_related_people" },
    { table: "eos_contact_issues" },
    { table: "eos_contact_todos" },
    { table: "eos_contact_habits" },
  ];
  for (const t of BULK_CONTACT_TABLES) {
    try {
      const col = t.column ?? "contact_id";
      const { data, error } = await supabase
        .from(t.table)
        .update({ [col]: keepLocalId })
        .eq(col, dupLocalId)
        .select("id");
      if (error) throw new Error(error.message);
      const moved = (data ?? []).length;
      if (moved > 0) {
        steps.push({ step: t.label ?? t.table, ok: true, detail: `${moved} reassigned` });
      }
    } catch (err) {
      steps.push({
        step: t.label ?? t.table,
        ok: false,
        detail: err instanceof Error ? err.message : "failed",
      });
    }
  }

  // 5. 1:1 tables — keeper wins. Only move the dup's row when keeper
  //    has none, otherwise the unique-on-contact_id index would error.
  const ONE_TO_ONE_TABLES = ["candidate_intelligence", "eos_contact_goals"];
  for (const table of ONE_TO_ONE_TABLES) {
    try {
      const { data: keeperRow } = await supabase.from(table).select("id").eq("contact_id", keepLocalId).maybeSingle();
      if (keeperRow) {
        steps.push({ step: table, ok: true, detail: "keeper kept (had own)" });
        continue;
      }
      const { data, error } = await supabase
        .from(table)
        .update({ contact_id: keepLocalId })
        .eq("contact_id", dupLocalId)
        .select("id");
      if (error) throw new Error(error.message);
      const moved = (data ?? []).length;
      if (moved > 0) {
        steps.push({ step: table, ok: true, detail: `${moved} moved from duplicate` });
      }
    } catch (err) {
      steps.push({
        step: table,
        ok: false,
        detail: err instanceof Error ? err.message : "failed",
      });
    }
  }

  // 6. ghl_contact_id-keyed tables — only when both sides have GHL IDs.
  if (dup?.ghl_contact_id && keep?.ghl_contact_id) {
    // 6a. Scout action logs — bulk reassign (history record on keeper).
    try {
      const { data, error } = await supabase
        .from("scout_action_logs")
        .update({ ghl_contact_id: keep.ghl_contact_id })
        .eq("ghl_contact_id", dup.ghl_contact_id)
        .select("id");
      if (error) throw new Error(error.message);
      const moved = (data ?? []).length;
      if (moved > 0) {
        steps.push({ step: "scout_action_logs", ok: true, detail: `${moved} reassigned` });
      }
    } catch (err) {
      steps.push({
        step: "scout_action_logs",
        ok: false,
        detail: err instanceof Error ? err.message : "failed",
      });
    }

    // 6b. Inactivity alerts — close the dup's open alerts (the contact
    //     is going away, those alerts are no longer actionable). Leave
    //     historical resolved alerts alone for audit.
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("inactivity_alerts")
        .update({ is_resolved: true, resolved_at: now })
        .eq("ghl_contact_id", dup.ghl_contact_id)
        .eq("is_resolved", false)
        .select("id");
      if (error) throw new Error(error.message);
      const closed = (data ?? []).length;
      if (closed > 0) {
        steps.push({ step: "inactivity_alerts", ok: true, detail: `${closed} resolved on duplicate` });
      }
    } catch (err) {
      steps.push({
        step: "inactivity_alerts",
        ok: false,
        detail: err instanceof Error ? err.message : "failed",
      });
    }

    // 6c. Workflow enrollments — exit any active/paused on the duplicate.
    //     We don't auto-enroll the keeper (avoids surprise duplicates if
    //     the keeper already has its own enrollment in the same workflow).
    try {
      const { data, error } = await supabase
        .from("workflow_enrollments")
        .update({
          status: "exited",
          exit_reason: `merged into ${keepName}`,
          completed_at: new Date().toISOString(),
        })
        .eq("ghl_contact_id", dup.ghl_contact_id)
        .in("status", ["active", "paused"])
        .select("id");
      if (error) throw new Error(error.message);
      const exited = (data ?? []).length;
      if (exited > 0) {
        steps.push({
          step: "workflow_enrollments",
          ok: true,
          detail: `${exited} exited on duplicate`,
        });
      }
    } catch (err) {
      steps.push({
        step: "workflow_enrollments",
        ok: false,
        detail: err instanceof Error ? err.message : "failed",
      });
    }

    // 6d. Territory ownership — if the duplicate is an active owner of
    //     any territory, transfer that ownership to the keeper. Surface
    //     the count so the user can verify; this is a high-impact move.
    try {
      const { data, error } = await supabase
        .from("territory_owners")
        .update({ ghl_contact_id: keep.ghl_contact_id })
        .eq("ghl_contact_id", dup.ghl_contact_id)
        .is("end_date", null)
        .select("TerritorySlug");
      if (error) throw new Error(error.message);
      const transferred = (data ?? []).length;
      if (transferred > 0) {
        const slugs = (data ?? []).map((r) => (r as { TerritorySlug: string }).TerritorySlug).join(", ");
        steps.push({
          step: "territory_owners",
          ok: true,
          detail: `${transferred} transferred (${slugs})`,
        });
      }
    } catch (err) {
      steps.push({
        step: "territory_owners",
        ok: false,
        detail: err instanceof Error ? err.message : "failed",
      });
    }
  }

  // 7. Mark the duplicate (last so reassignments are committed first)
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

  // 8. GHL: add a note on the keeper documenting the merge + tag the dup.
  if (keep?.ghl_contact_id) {
    try {
      const noteBody = `Merged ${dupName} into this contact${reason ? ` — ${reason}` : ""}. (${new Date().toLocaleString()})`;
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

  return {
    ok: true,
    success: steps.every((s) => s.ok || s.step === "ghl_keeper_note" || s.step === "ghl_dup_tag"),
    duplicate: { id: dupLocalId, name: dupName },
    keeper: { id: keepLocalId, name: keepName },
    steps,
  };
}
