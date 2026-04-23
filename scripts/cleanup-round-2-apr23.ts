/**
 * Round-2 contact cleanup — eight same-name dupes surfaced after the
 * nickname-fold + partnership-split pass, plus one junk row.
 *
 * For each pair the pattern is identical to the earlier dedupe: one
 * record is the active franchisee / real journey holder, the other is
 * a stale partnership/nickname record (or a stub I just created during
 * the split). Merge → absorb drop's email into keep's contact_emails
 * as a secondary → move every FK from drop → keep → delete drop.
 *
 * Because the "drop" side often owns its own journey (the stale
 * partnership/nickname journey), after the contact merge the keep ends
 * up primary of two journeys — the real franchisee one + the stale
 * one. A second pass collapses each pair by moving live members and
 * non-followup jps rows onto the real journey, then deleting the
 * stale one.
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

interface Contact {
  id: string;
  ghl_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

async function loadAll(): Promise<Contact[]> {
  const PAGE = 1000;
  const out: Contact[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name, email")
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    out.push(...(data as Contact[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

interface Pair {
  who: string;
  keepShort: string;
  dropShort: string;
}

const PAIRS: Pair[] = [
  { who: "Jon Kim",         keepShort: "7f150b60", dropShort: "b95467be" },
  { who: "Joseph Putra",    keepShort: "e6cfb945", dropShort: "c4d702ad" },
  { who: "Ryan Lentz",      keepShort: "58054950", dropShort: "7bd4e6b8" },
  { who: "Marco Pena",      keepShort: "81240cdf", dropShort: "fc2243a9" },
  { who: "Marta Pena",      keepShort: "e7f9c223", dropShort: "b23e72ed" },
  { who: "Steven Mills",    keepShort: "e8ccea43", dropShort: "1d09b861" },
  { who: "Tori Mills",      keepShort: "1c90688f", dropShort: "2f7d5034" },
  { who: "Stephanie Hall",  keepShort: "577186a8", dropShort: "d3ee670e" },
];

/** FK tables that carry a contact_id or ghl_contact_id we need to re-point. */
const FK_MOVES: Array<{
  table: string; fkColumn: string; fkType: "contact_id" | "ghl_contact_id";
  uniqueCols?: string[];
}> = [
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

async function mergeContacts(keep: Contact, drop: Contact, dry: boolean): Promise<void> {
  console.log(`\n── ${keep.first_name} ${keep.last_name}`);
  console.log(`   keep ${keep.id.slice(0, 8)} email=${keep.email ?? "null"} ghl=${keep.ghl_contact_id?.slice(0, 16) ?? "—"}`);
  console.log(`   drop ${drop.id.slice(0, 8)} email=${drop.email ?? "null"} ghl=${drop.ghl_contact_id?.slice(0, 16) ?? "—"}`);

  if (drop.email && drop.email.toLowerCase() !== (keep.email ?? "").toLowerCase()) {
    if (dry) {
      console.log(`   would absorb ${drop.email} as secondary`);
    } else {
      const { error } = await supabase.from("contact_emails").insert({
        contact_id: keep.id, email: drop.email, is_primary: false, source: "merge",
      });
      if (error && !error.message.includes("duplicate")) {
        console.log(`   email-absorb ERR ${error.message}`);
      } else {
        console.log(`   absorbed ${drop.email}`);
      }
    }
  }

  for (const move of FK_MOVES) {
    const from = move.fkType === "ghl_contact_id" ? drop.ghl_contact_id : drop.id;
    const to = move.fkType === "ghl_contact_id" ? keep.ghl_contact_id : keep.id;
    if (!from || !to) continue;
    const n = await moveFk(move, from, to, dry);
    if (n > 0) console.log(`   ${dry ? "would move" : "moved"} ${n}× ${move.table}.${move.fkColumn}`);
  }

  if (!dry) {
    // Carry drop's extra emails as secondaries on keep.
    const { data: extraEmails } = await supabase
      .from("contact_emails").select("email, label").eq("contact_id", drop.id);
    for (const e of extraEmails ?? []) {
      await supabase.from("contact_emails").insert({
        contact_id: keep.id, email: e.email, is_primary: false, label: e.label, source: "merge",
      }).then(() => {}, () => {});
    }
    await supabase.from("contact_emails").delete().eq("contact_id", drop.id);
    const { error } = await supabase.from("contacts").delete().eq("id", drop.id);
    if (error) console.log(`   DELETE drop ERR ${error.message}`);
    else console.log(`   deleted drop`);
  } else {
    console.log(`   would delete drop`);
  }
}

/**
 * After contact merges, each keep may now own two journeys — the real
 * franchisee journey (sales→onboarding→runway with a territory) and a
 * stale followup/partnership journey absorbed from the drop. Collapse
 * them: pick the real journey, move any missing members to it, then
 * cascade-delete the stale one.
 */
async function collapseKeepJourneys(keepId: string, dry: boolean): Promise<void> {
  const { data: js } = await supabase
    .from("journeys")
    .select("id, name, created_at")
    .eq("primary_contact_id", keepId);
  if (!js || js.length <= 1) return;

  // Classify each journey by its pipelines.
  interface JInfo { id: string; name: string; real: boolean; }
  const infos: JInfo[] = [];
  for (const j of js) {
    const { data: jps } = await supabase
      .from("journey_pipeline_state")
      .select("pipelines(slug)")
      .eq("journey_id", j.id).eq("is_active", true);
    const real = (jps ?? []).some((p) => {
      const slug = (p.pipelines as unknown as { slug: string } | null)?.slug;
      return slug === "sales" || slug === "onboarding" || slug === "runway" || slug === "territories";
    });
    infos.push({ id: j.id, name: j.name, real });
  }

  const real = infos.find((i) => i.real);
  const stale = infos.filter((i) => !i.real);
  if (!real || stale.length === 0) return;

  console.log(`   keep has ${js.length} journeys — real: "${real.name}", stale: ${stale.map((s) => `"${s.name}"`).join(", ")}`);
  for (const s of stale) {
    // Move non-primary members of the stale journey onto the real journey.
    const { data: mems } = await supabase
      .from("journey_contacts").select("id, contact_id, role").eq("journey_id", s.id).is("left_at", null);
    for (const m of mems ?? []) {
      if (m.contact_id === keepId) continue; // primary role already exists on real journey
      const { data: existing } = await supabase
        .from("journey_contacts").select("id").eq("journey_id", real.id).eq("contact_id", m.contact_id).is("left_at", null);
      if (existing && existing.length > 0) continue;
      if (dry) {
        console.log(`   would move ${m.role} member ${m.contact_id.slice(0, 8)} → "${real.name}"`);
      } else {
        await supabase.from("journey_contacts").update({ journey_id: real.id }).eq("id", m.id);
        console.log(`   moved ${m.role} member ${m.contact_id.slice(0, 8)} → "${real.name}"`);
      }
    }
    if (dry) {
      console.log(`   would delete stale journey ${s.id.slice(0, 8)} "${s.name}"`);
    } else {
      const { error } = await supabase.from("journeys").delete().eq("id", s.id);
      if (error) console.log(`   stale-journey delete ERR ${error.message}`);
      else console.log(`   deleted stale journey ${s.id.slice(0, 8)} "${s.name}"`);
    }
  }
}

async function deleteContact(contactId: string, dry: boolean, label: string): Promise<void> {
  console.log(`\n── DELETE ${label} (${contactId.slice(0, 8)})`);
  if (dry) { console.log("   would delete"); return; }
  const { data: js } = await supabase.from("journeys").select("id").eq("primary_contact_id", contactId);
  for (const j of js ?? []) {
    await supabase.from("journeys").delete().eq("id", j.id);
  }
  await supabase.from("call_participants").update({ contact_id: null }).eq("contact_id", contactId);
  await supabase.from("contact_emails").delete().eq("contact_id", contactId);
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  if (error) console.log(`   ERR ${error.message}`);
  else console.log("   deleted");
}

async function main(live: boolean): Promise<void> {
  const dry = !live;
  console.log(`Mode: ${live ? "LIVE" : "DRY RUN"}`);

  const all = await loadAll();
  const byShort = new Map<string, Contact>();
  for (const c of all) byShort.set(c.id.slice(0, 8), c);

  // ── Merge pairs ─────────────────────────────────────────────────────
  console.log("\n═══ CONTACT MERGES ═══");
  const keepIds: string[] = [];
  for (const p of PAIRS) {
    const keep = byShort.get(p.keepShort);
    const drop = byShort.get(p.dropShort);
    if (!keep || !drop) { console.log(`\n[skip] ${p.who}: keep=${keep?.id.slice(0, 8) ?? "?"} drop=${drop?.id.slice(0, 8) ?? "?"} missing`); continue; }
    await mergeContacts(keep, drop, dry);
    keepIds.push(keep.id);
  }

  // ── Collapse resulting duplicate journeys ───────────────────────────
  console.log("\n\n═══ JOURNEY CONSOLIDATION ═══");
  for (const id of keepIds) {
    await collapseKeepJourneys(id, dry);
  }

  // ── Delete junk ─────────────────────────────────────────────────────
  console.log("\n\n═══ DELETE JUNK ═══");
  const bb = byShort.get("da16adbb");
  if (bb) await deleteContact(bb.id, dry, "B B (sdsds@gmail.com)");
}

void main(process.argv.includes("--live")).catch((e) => {
  console.error(e);
  process.exit(1);
});
