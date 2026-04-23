/**
 * Round-3 cleanup. After the rename/split pass and round-2 contact
 * merges, some journey-level housekeeping is still outstanding:
 *
 *   A. Journey names still contain the old parenthetical lead-source
 *      tags because we only renamed the contacts. Rename the 7 affected
 *      journeys so they match their primary's current name.
 *
 *   B. Joseph Putra now owns two followup journeys (his real one and
 *      the inherited "Yusuf 'joseph' Putra" one). Delete the redundant
 *      one; keep the one with the correct name.
 *
 *   C. Three partnership journeys are redundant — the couple already
 *      has a real franchisee journey on the active partner's side.
 *      Handle each:
 *        - Pena: delete "Marta / Marco Pena" (followup). Marta is
 *          already family of Marco's real HUSTNE journey; nothing to
 *          move. Marco is only a co_primary on the stale journey
 *          because of the earlier split — that's what cascades.
 *        - Mills: same shape — delete "Steven And Tori Mills". Steven
 *          is already family of Tori's real MONRLA journey.
 *        - Hall: James Hall (5d9d6499) is the renamed leftover from
 *          "Tim (james) And Stephanie Hall". The real franchisee
 *          record is Tim Hall (eeba07fc, GRNVSC, runway). Same person
 *          per the user's nickname-fold rule (Tim goes by James).
 *          Merge James → Tim, rename keep to James Hall, then collapse
 *          the duplicate journeys.
 *
 * Dry-run by default. Pass --live to apply.
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
const supabase: SupabaseClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

// ── A. Journey renames ──────────────────────────────────────────────
const JOURNEY_RENAMES: Array<{ id: string; newName: string }> = [
  { id: "f2e41b3a-", newName: "Evan Lee" },
  { id: "5bfacfc3-", newName: "Jared Freeman" },
  { id: "8c94f0c7-", newName: "Richard And Scott Bonar" },
  { id: "fb885af8-", newName: "Matt Mullins" },
  { id: "fa9d3051-", newName: "Srini Saranu" },
  { id: "1b6e7026-", newName: "Samir Abdelfattah" },
  { id: "51d3aab5-", newName: "Dwan Garedner" },
];

// ── B. Joseph Putra's duplicate followup journey ────────────────────
const PUTRA_DROP_JOURNEY = "349f6d81-"; // "Yusuf \"joseph\" Putra"
const PUTRA_KEEP_JOURNEY = "420a01d5-"; // "Joseph Putra"

// ── C. Partnership journeys to delete ───────────────────────────────
const PARTNERSHIP_DELETES: string[] = [
  "7df8b5df-", // "Marta / Marco Pena"
  "bc8fb7b2-", // "Steven And Tori Mills"
];

// ── C2. Hall contact merge ──────────────────────────────────────────
const JAMES_HALL_CONTACT = "5d9d6499-"; // "James Hall" (renamed from Tim(james) And Stephanie Hall)
const TIM_HALL_CONTACT   = "eeba07fc-"; // real "Tim Hall" (GRNVSC franchisee)
const HALL_PARTNERSHIP_JOURNEY = "3181bae5-"; // "Tim (james) And Stephanie Hall"

async function resolveByPrefix(table: string, prefixStem: string): Promise<any | null> {
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase.from(table).select("*").range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) return null;
    const hit = data.find((r) => r.id.startsWith(prefixStem));
    if (hit) return hit;
    if (data.length < PAGE) return null;
    offset += PAGE;
  }
}

const FK_MOVES: Array<{ table: string; fkColumn: string; fkType: "contact_id" | "ghl_contact_id"; uniqueCols?: string[] }> = [
  { table: "journey_contacts",         fkColumn: "contact_id",         fkType: "contact_id", uniqueCols: ["journey_id", "contact_id"] },
  { table: "journeys",                 fkColumn: "primary_contact_id", fkType: "contact_id" },
  { table: "contact_related_people",   fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "contact_related_people",   fkColumn: "linked_contact_id",  fkType: "contact_id" },
  { table: "contact_team_members",     fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "contact_profile_fields",   fkColumn: "contact_id",         fkType: "contact_id", uniqueCols: ["contact_id", "field_slug"] },
  { table: "contact_activity_messages",fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "calls",                    fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "call_participants",        fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "call_review_packages",     fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "embeddings",               fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "notifications",            fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "ghl_sync_queue",           fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "ghl_action_drafts",        fkColumn: "contact_id",         fkType: "contact_id" },
  { table: "territory_owners",         fkColumn: "ghl_contact_id",     fkType: "ghl_contact_id" },
  { table: "contact_scores",           fkColumn: "ghl_contact_id",     fkType: "ghl_contact_id" },
];

async function moveFk(move: typeof FK_MOVES[number], from: string, to: string, dry: boolean): Promise<number> {
  const { data } = await supabase.from(move.table).select("*").eq(move.fkColumn, from);
  if (!data || data.length === 0) return 0;
  if (dry) return data.length;
  let moved = 0;
  for (const row of data) {
    if (move.uniqueCols) {
      let probe = supabase.from(move.table).select("id");
      for (const c of move.uniqueCols) {
        const v = c === move.fkColumn ? to : (row as Record<string, unknown>)[c];
        probe = probe.eq(c, v);
      }
      const { data: collision } = await probe;
      const rowId = (row as { id?: string }).id;
      if (collision && collision.length > 0 && (collision[0] as { id: string }).id !== rowId) {
        if (rowId) await supabase.from(move.table).delete().eq("id", rowId);
        continue;
      }
    }
    const rowId = (row as { id?: string }).id;
    if (rowId) {
      await supabase.from(move.table).update({ [move.fkColumn]: to }).eq("id", rowId);
    } else {
      await supabase.from(move.table).update({ [move.fkColumn]: to }).eq(move.fkColumn, from);
    }
    moved += 1;
  }
  return moved;
}

async function main(live: boolean): Promise<void> {
  const dry = !live;
  console.log(`Mode: ${live ? "LIVE" : "DRY RUN"}\n`);

  // ── A. Rename stale journey names ─────────────────────────────────
  console.log("═══ JOURNEY RENAMES ═══");
  for (const r of JOURNEY_RENAMES) {
    const j = await resolveByPrefix("journeys", r.id);
    if (!j) { console.log(`  [skip] ${r.id} not found`); continue; }
    console.log(`  ${j.id.slice(0, 8)}  "${j.name}"  →  "${r.newName}"`);
    if (!dry) {
      const { error } = await supabase.from("journeys").update({ name: r.newName }).eq("id", j.id);
      if (error) console.log(`    ERR ${error.message}`);
    }
  }

  // ── B. Joseph Putra duplicate followup journey ────────────────────
  console.log("\n═══ JOSEPH PUTRA DUPE JOURNEY ═══");
  const putraDrop = await resolveByPrefix("journeys", PUTRA_DROP_JOURNEY);
  const putraKeep = await resolveByPrefix("journeys", PUTRA_KEEP_JOURNEY);
  if (putraDrop && putraKeep) {
    console.log(`  drop ${putraDrop.id.slice(0, 8)} "${putraDrop.name}"`);
    console.log(`  keep ${putraKeep.id.slice(0, 8)} "${putraKeep.name}"`);
    if (!dry) {
      // Move any members that aren't already on keep, then cascade-delete drop.
      const { data: mems } = await supabase.from("journey_contacts").select("id, contact_id, role").eq("journey_id", putraDrop.id).is("left_at", null);
      for (const m of mems ?? []) {
        const { data: exists } = await supabase.from("journey_contacts").select("id").eq("journey_id", putraKeep.id).eq("contact_id", m.contact_id).is("left_at", null);
        if (exists && exists.length > 0) continue;
        await supabase.from("journey_contacts").update({ journey_id: putraKeep.id }).eq("id", m.id);
      }
      const { error } = await supabase.from("journeys").delete().eq("id", putraDrop.id);
      if (error) console.log(`    ERR ${error.message}`);
      else console.log("    deleted");
    }
  }

  // ── C. Partnership journey deletes ────────────────────────────────
  console.log("\n═══ PARTNERSHIP JOURNEYS ═══");
  for (const prefix of PARTNERSHIP_DELETES) {
    const j = await resolveByPrefix("journeys", prefix);
    if (!j) { console.log(`  [skip] ${prefix} not found`); continue; }
    console.log(`  ${j.id.slice(0, 8)} "${j.name}" — delete (couple is fully represented on the real franchisee journey)`);
    if (!dry) {
      const { error } = await supabase.from("journeys").delete().eq("id", j.id);
      if (error) console.log(`    ERR ${error.message}`);
      else console.log("    deleted");
    }
  }

  // ── C2. Merge James Hall → Tim Hall, rename to James Hall ─────────
  console.log("\n═══ HALL CONTACT MERGE ═══");
  const james = await resolveByPrefix("contacts", JAMES_HALL_CONTACT);
  const tim = await resolveByPrefix("contacts", TIM_HALL_CONTACT);
  if (!james || !tim) {
    console.log(`  [skip] James=${james?.id.slice(0, 8) ?? "?"} Tim=${tim?.id.slice(0, 8) ?? "?"} missing`);
  } else {
    console.log(`  james ${james.id.slice(0, 8)}  ${james.first_name} ${james.last_name}  phone=${james.phone ?? "null"}`);
    console.log(`  tim   ${tim.id.slice(0, 8)}  ${tim.first_name} ${tim.last_name}  email=${tim.email}  phone=${tim.phone ?? "null"}`);

    if (dry) {
      console.log(`  would move all FKs from James → Tim, delete James, rename Tim → "James Hall"`);
    } else {
      // Fill in any nulls on keep (Tim) from drop (James). Both Hall phones
      // are SC area-864 numbers — likely two phones for one person.
      const patch: Record<string, unknown> = {};
      if (!tim.phone && james.phone) patch.phone = james.phone;
      if (!tim.city && james.city) patch.city = james.city;
      if (!tim.state && james.state) patch.state = james.state;
      if (!tim.zip && james.zip) patch.zip = james.zip;
      if (!tim.address && james.address) patch.address = james.address;
      if (Object.keys(patch).length > 0) {
        await supabase.from("contacts").update(patch).eq("id", tim.id);
        console.log(`    carried fields from James → Tim: ${Object.keys(patch).join(", ")}`);
      }

      // Move FKs.
      for (const move of FK_MOVES) {
        const from = move.fkType === "ghl_contact_id" ? james.ghl_contact_id : james.id;
        const to = move.fkType === "ghl_contact_id" ? tim.ghl_contact_id : tim.id;
        if (!from || !to) continue;
        const n = await moveFk(move, from, to, false);
        if (n > 0) console.log(`    moved ${n}× ${move.table}.${move.fkColumn}`);
      }

      await supabase.from("contact_emails").delete().eq("contact_id", james.id);
      const { error: delErr } = await supabase.from("contacts").delete().eq("id", james.id);
      if (delErr) console.log(`    DELETE james ERR ${delErr.message}`);
      else console.log(`    deleted james ${james.id.slice(0, 8)}`);

      // Rename Tim → James per user's fold-nickname rule.
      await supabase.from("contacts").update({ first_name: "James" }).eq("id", tim.id);
      console.log(`    renamed keep first_name Tim → James`);

      // After the merge, Tim/James owns two journeys (GRNVSC runway + Hall
      // partnership followup). Collapse — delete the stale partnership journey
      // after moving Stephanie's co_primary membership onto the real journey.
      const realJourney = (await supabase.from("journeys").select("id, name").eq("primary_contact_id", tim.id).ilike("name", "Tim Hall%").maybeSingle()).data;
      const partnershipJourney = await resolveByPrefix("journeys", HALL_PARTNERSHIP_JOURNEY);
      if (realJourney && partnershipJourney) {
        // Move Stephanie Hall to real journey (as co_primary).
        const { data: partnershipMems } = await supabase
          .from("journey_contacts").select("id, contact_id, role")
          .eq("journey_id", partnershipJourney.id).is("left_at", null);
        for (const m of partnershipMems ?? []) {
          if (m.contact_id === tim.id) continue;
          const { data: exists } = await supabase.from("journey_contacts").select("id").eq("journey_id", realJourney.id).eq("contact_id", m.contact_id).is("left_at", null);
          if (exists && exists.length > 0) {
            // Already family on real journey — leave as-is.
            continue;
          }
          await supabase.from("journey_contacts").update({ journey_id: realJourney.id, role: m.role }).eq("id", m.id);
          console.log(`    moved ${m.role} member ${m.contact_id.slice(0, 8)} → "${realJourney.name}"`);
        }
        const { error: delJErr } = await supabase.from("journeys").delete().eq("id", partnershipJourney.id);
        if (delJErr) console.log(`    DELETE partnership journey ERR ${delJErr.message}`);
        else console.log(`    deleted partnership journey ${partnershipJourney.id.slice(0, 8)}`);

        await supabase.from("journeys").update({ name: "James Hall" }).eq("id", realJourney.id);
        console.log(`    renamed real journey → "James Hall"`);
      }
    }
  }
}

void main(process.argv.includes("--live")).catch((e) => {
  console.error(e);
  process.exit(1);
});
