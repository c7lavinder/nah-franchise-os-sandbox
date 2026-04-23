/**
 * Cleanup script for the ecosystem-modal bug where /api/contacts/create
 * was auto-enrolling every new contact in the sales pipeline.
 *
 * What it finds and fixes:
 *   1. Contacts who are primary on an active journey AND have a territory
 *      stakeholder link — these are by definition misclassified (only
 *      prospects and franchisees own journeys).
 *   2. Duplicate contact rows with the same first+last name, where one is
 *      the ecosystem-modal-created row (has stakeholder link, likely newer)
 *      and the other is the canonical pre-existing contact.
 *
 * What it does for each:
 *   - Picks a canonical contact (older created_at wins). Moves FKs from the
 *     other side onto the canonical — stakeholder link, call_participants,
 *     call contact_id, related people, journey memberships, emails, etc.
 *   - Absorbs the duplicate's email into canonical's contact_emails.
 *   - Deletes the duplicate contact.
 *   - Archives any journey where the canonical (now a stakeholder) is the
 *     primary — including journeys that existed independently of the bug
 *     (e.g., a prior GHL auto-create).
 *   - Deactivates the archived journey's jps rows so the classifier won't
 *     still pick them up.
 *
 * Safe to re-run. Dry-run by default — pass --live to apply.
 *
 *   DRY RUN:  npx tsx scripts/cleanup-ecosystem-journeys.ts
 *   LIVE:     npx tsx scripts/cleanup-ecosystem-journeys.ts --live
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

const LIVE = process.argv.includes("--live");

interface Contact {
  id: string;
  ghl_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

interface FkMove {
  table: string;
  fkColumn: string;
  fkType: "contact_id" | "ghl_contact_id";
  uniqueCols?: string[];
}

const FK_MOVES: FkMove[] = [
  { table: "territory_stakeholders",   fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "journey_contacts",         fkColumn: "contact_id",         fkType: "contact_id", uniqueCols: ["journey_id", "contact_id"] },
  { table: "journeys",                 fkColumn: "primary_contact_id", fkType: "contact_id" },
  { table: "contact_related_people",   fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "contact_related_people",   fkColumn: "linked_contact_id",  fkType: "contact_id" },
  { table: "call_participants",        fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "calls",                    fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "contact_emails",           fkColumn: "contact_id",         fkType: "contact_id", uniqueCols: ["contact_id", "email"] },
  { table: "contact_profile_fields",   fkColumn: "contact_id",         fkType: "contact_id", uniqueCols: ["contact_id", "field_slug"] },
  { table: "eos_contact_goals",        fkColumn: "contact_id",         fkType: "contact_id", uniqueCols: ["contact_id"] },
  { table: "contact_activity_messages",fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "contact_team_members",     fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "call_review_packages",     fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "embeddings",               fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "notifications",            fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "ghl_sync_queue",           fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "ghl_action_drafts",        fkColumn: "contact_id",         fkType: "contact_id" },
];

async function moveFkRows(
  db: SupabaseClient, move: FkMove, fromValue: string, toValue: string, dryRun: boolean,
): Promise<{ moved: number; skippedCollision: number; error?: string }> {
  const col = move.fkColumn;
  const { data: rows, error } = await db.from(move.table).select("*").eq(col, fromValue);
  if (error) return { moved: 0, skippedCollision: 0, error: error.message };
  if (!rows || rows.length === 0) return { moved: 0, skippedCollision: 0 };
  if (dryRun) return { moved: rows.length, skippedCollision: 0 };

  let moved = 0;
  let skipped = 0;
  for (const r of rows) {
    if (move.uniqueCols && move.uniqueCols.length > 0) {
      let probe = db.from(move.table).select("id");
      for (const c of move.uniqueCols) {
        const v = c === col ? toValue : (r as Record<string, unknown>)[c];
        probe = probe.eq(c, v);
      }
      const { data: collision } = await probe;
      if (collision && collision.length > 0 && (collision[0] as { id: string }).id !== (r as { id: string }).id) {
        await db.from(move.table).delete().eq("id", (r as { id: string }).id);
        skipped += 1;
        continue;
      }
    }
    const rowId = (r as { id?: string }).id;
    let upErr: { message: string } | null = null;
    if (rowId) {
      const res = await db.from(move.table).update({ [col]: toValue }).eq("id", rowId);
      upErr = res.error;
    } else {
      const res = await db.from(move.table).update({ [col]: toValue }).eq(col, fromValue);
      upErr = res.error;
    }
    if (upErr) return { moved, skippedCollision: skipped, error: `${move.table}: ${upErr.message}` };
    moved += 1;
  }
  return { moved, skippedCollision: skipped };
}

async function archiveJourney(journeyId: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    console.log(`       would archive journey ${journeyId.slice(0, 8)} + deactivate its jps rows`);
    return;
  }
  await supabase.from("journeys").update({ status: "archived" }).eq("id", journeyId);
  await supabase.from("journey_pipeline_state").update({ is_active: false }).eq("journey_id", journeyId);
  console.log(`       archived journey ${journeyId.slice(0, 8)}`);
}

async function mergeContact(
  dup: Contact, keep: Contact, dryRun: boolean,
): Promise<void> {
  console.log(`     keep ${keep.id.slice(0, 8)} (${keep.email}, created ${keep.created_at.slice(0, 10)})`);
  console.log(`     drop ${dup.id.slice(0, 8)} (${dup.email}, created ${dup.created_at.slice(0, 10)})`);

  // Pull dropped side's email into keeper's contact_emails.
  if (dup.email) {
    if (dryRun) {
      console.log(`       would absorb email ${dup.email} into ${keep.id.slice(0, 8)}`);
    } else {
      const { error: emErr } = await supabase.from("contact_emails").insert({
        contact_id: keep.id, email: dup.email, is_primary: false, source: "merge",
      });
      if (emErr && !emErr.message.toLowerCase().includes("duplicate")) {
        console.log(`       email-add warn: ${emErr.message}`);
      }
    }
  }

  for (const move of FK_MOVES) {
    const fromValue = move.fkType === "ghl_contact_id" ? dup.ghl_contact_id : dup.id;
    const toValue = move.fkType === "ghl_contact_id" ? keep.ghl_contact_id : keep.id;
    if (!fromValue || !toValue) continue;
    const result = await moveFkRows(supabase, move, fromValue, toValue, dryRun);
    if (result.moved > 0 || result.skippedCollision > 0 || result.error) {
      const prefix = dryRun ? "       would move" : "       moved";
      console.log(`${prefix} ${move.table}.${move.fkColumn}: ${result.moved}${result.skippedCollision ? ` (+${result.skippedCollision} collisions)` : ""}${result.error ? ` — ERR ${result.error}` : ""}`);
    }
  }

  if (!dryRun) {
    await supabase.from("contact_emails").delete().eq("contact_id", dup.id);
    const { error: delErr } = await supabase.from("contacts").delete().eq("id", dup.id);
    if (delErr) console.log(`       DELETE drop ERR: ${delErr.message}`);
    else console.log(`       deleted drop ${dup.id.slice(0, 8)}`);
  } else {
    console.log(`       would delete drop ${dup.id.slice(0, 8)}`);
  }
}

async function backfillCallParticipantEmails(keptContactId: string, dryRun: boolean): Promise<void> {
  // Every call_participants row pointing at this contact should also be in
  // contact_emails. Keeps the multi-email list honest after a merge.
  const { data: rows } = await supabase
    .from("call_participants")
    .select("email")
    .eq("contact_id", keptContactId)
    .not("email", "is", null);
  const unique = [...new Set((rows ?? []).map((r) => (r.email as string).toLowerCase().trim()))];
  if (unique.length === 0) return;
  console.log(`       ensuring ${unique.length} participant email(s) on contact_emails:`);
  for (const email of unique) {
    const { data: existing } = await supabase
      .from("contact_emails")
      .select("id")
      .eq("contact_id", keptContactId)
      .eq("email", email)
      .maybeSingle();
    if (existing) continue;
    if (dryRun) {
      console.log(`         would add ${email}`);
    } else {
      const { error } = await supabase.from("contact_emails").insert({
        contact_id: keptContactId, email, is_primary: false, source: "merge",
      });
      if (error && !error.message.toLowerCase().includes("duplicate")) {
        console.log(`         add-email warn ${email}: ${error.message}`);
      } else {
        console.log(`         added ${email}`);
      }
    }
  }
}

async function main(): Promise<void> {
  console.log(`Mode: ${LIVE ? "LIVE" : "DRY RUN"}\n`);

  // Load every contact — we need name-based duplicate lookup across the table.
  const PAGE = 1000;
  const all: Contact[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name, email, phone, created_at, updated_at")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as Contact[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  const byId = new Map<string, Contact>();
  const byName = new Map<string, Contact[]>();
  for (const c of all) {
    byId.set(c.id, c);
    const key = `${(c.first_name ?? "").toLowerCase().trim()}|${(c.last_name ?? "").toLowerCase().trim()}`;
    if (key === "|") continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(c);
  }

  // Only roles that are categorically NOT prospects/franchisees. "owner" is
  // legit franchisee ownership. "family" and "partner" are ambiguous — they
  // can be legitimate co-primaries on a partnership journey — so we skip
  // them and let the rep reconcile by hand if needed.
  const NON_JOURNEY_ROLES = new Set([
    "employee", "contractor", "agent", "lender", "lawyer", "other",
  ]);

  const { data: stakeRows } = await supabase
    .from("territory_stakeholders")
    .select("contact_id, ms_slug, role")
    .not("contact_id", "is", null)
    .eq("is_active", true);
  const stakeholderIds = Array.from(new Set(
    (stakeRows ?? [])
      .filter((r) => NON_JOURNEY_ROLES.has(r.role))
      .map((r) => r.contact_id as string),
  ));
  console.log(`Found ${stakeholderIds.length} contact(s) in roles that can't own a journey (employee/contractor/agent/lender/lawyer/other).\n`);

  for (const contactId of stakeholderIds) {
    const contact = byId.get(contactId);
    if (!contact) continue;
    const label = `${contact.first_name ?? "—"} ${contact.last_name ?? "—"}`.trim();
    const key = `${(contact.first_name ?? "").toLowerCase().trim()}|${(contact.last_name ?? "").toLowerCase().trim()}`;
    const sameName = (byName.get(key) ?? []).filter((c) => c.id !== contactId);

    console.log(`── ${label}  (${contact.id.slice(0, 8)}) ──`);

    if (sameName.length === 0) {
      console.log(`   no same-name duplicate`);
    } else {
      console.log(`   found ${sameName.length} same-name duplicate(s):`);
      for (const d of sameName) {
        console.log(`     - ${d.id.slice(0, 8)}  email=${d.email ?? "—"}  created=${d.created_at.slice(0, 10)}`);
      }

      // Canonical = oldest created_at — pre-dates the ecosystem bug.
      const candidates = [contact, ...sameName].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const keep = candidates[0];
      const drops = candidates.slice(1);
      for (const dup of drops) {
        await mergeContact(dup, keep, !LIVE);
      }
      // Backfill participant emails onto the keeper.
      if (LIVE) await backfillCallParticipantEmails(keep.id, false);
      else await backfillCallParticipantEmails(keep.id, true);

      // After merge, inspect the keeper for any primary journeys that shouldn't exist.
      const { data: keeperJourneys } = await supabase
        .from("journeys")
        .select("id, name")
        .eq("primary_contact_id", keep.id)
        .eq("status", "active");
      for (const j of keeperJourneys ?? []) {
        console.log(`   keeper still has active journey: ${j.name} (${j.id.slice(0, 8)})`);
        await archiveJourney(j.id, !LIVE);
      }
      console.log();
      continue;
    }

    // Single contact with a stakeholder link — archive any primary journey.
    const { data: ownJourneys } = await supabase
      .from("journeys")
      .select("id, name")
      .eq("primary_contact_id", contactId)
      .eq("status", "active");
    if (!ownJourneys || ownJourneys.length === 0) {
      console.log(`   clean — no stray journey`);
    } else {
      for (const j of ownJourneys) {
        console.log(`   stray journey: ${j.name} (${j.id.slice(0, 8)})`);
        await archiveJourney(j.id, !LIVE);
      }
    }
    await backfillCallParticipantEmails(contactId, !LIVE);
    console.log();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
