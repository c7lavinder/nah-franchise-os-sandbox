/**
 * Round-3 cleanup of remaining name issues surfaced by the punctuation scan.
 *
 *  1. Fold quoted/parenthetical nicknames into first name:
 *       Hyung "jon" Kim       → Jon Kim
 *       Yusuf "joseph" Putra  → Joseph Putra
 *       Claude "bear" Majester → Bear Majester
 *       Srinivas (srini) Saranu → Srini Saranu
 *
 *  2. Strip lead-source notes tacked onto names:
 *       Richard And Scott Bonar (derk/cari Referral) → Richard And Scott Bonar
 *       Samir Abdelfattah (stephen Haynes)           → Samir Abdelfattah
 *       Matt Mullins (stephen Haynes)                → Matt Mullins
 *       Jared Freeman (joe Kraus)                    → Jared Freeman
 *       Dwan Garedner (fbr Lead)                     → Dwan Garedner
 *       Evan Lee (i'm Serious)                       → Evan Lee
 *
 *  3. Split partnership rows into two contacts in the same journey.
 *     The original record keeps its email/phone/ghl_contact_id (those
 *     belong to the named partner). The new contact is a sparse stub
 *     linked as co_primary.
 *       Robert & Traci Owor           → Robert Owor   + Traci Owor
 *       Ryan & Katy Lentz             → Ryan Lentz    + Katy Lentz
 *       Tim (james) And Stephanie Hall → James Hall    + Stephanie Hall
 *       Steven And Tori Mills         → Steven Mills  + Tori Mills
 *       Marta / Marco Pena            → Marta Pena    + Marco Pena
 *
 *  4. Delete junk/system accounts:
 *       Sales Inquiries (default)   sales@caliper.com
 *       Naf Austin Tx, East         austineast@newagainhouses.com
 *
 *  5. Fix apostrophe casing on 3 names, straightening curly quotes:
 *       Donna O'brien       → Donna O'Brien
 *       Dan D'alessio       → Dan D'Alessio
 *       D'anntoinette Jones → D'Anntoinette Jones
 *
 * Dry-run by default. Pass --live to apply.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase: SupabaseClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  ghl_contact_id: string | null;
}

async function loadAll(): Promise<Contact[]> {
  const PAGE = 1000;
  const out: Contact[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, ghl_contact_id")
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    out.push(...(data as Contact[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

// ── Lookup tables ────────────────────────────────────────────────────

interface Rename { shortId: string; first: string; last: string; }

const NICKNAMES: Rename[] = [
  { shortId: "b95467be", first: "Jon",    last: "Kim" },
  { shortId: "e6cfb945", first: "Joseph", last: "Putra" },
  { shortId: "8b8b4339", first: "Bear",   last: "Majester" },
  { shortId: "4c0c58cf", first: "Srini",  last: "Saranu" },
];

const STRIP_PARENS: Rename[] = [
  { shortId: "f3945366", first: "Richard And Scott", last: "Bonar" },
  { shortId: "4dcbded5", first: "Samir",             last: "Abdelfattah" },
  { shortId: "1e38a3f5", first: "Matt",              last: "Mullins" },
  { shortId: "e62c3b12", first: "Jared",             last: "Freeman" },
  { shortId: "9b51e18c", first: "Dwan",              last: "Garedner" },
  { shortId: "27c13281", first: "Evan",              last: "Lee" },
];

interface Split {
  shortId: string;
  keep: { first: string; last: string };
  newPartner: { first: string; last: string };
}

const SPLITS: Split[] = [
  { shortId: "62da552e", keep: { first: "Robert",   last: "Owor"   }, newPartner: { first: "Traci",     last: "Owor"   } },
  { shortId: "7bd4e6b8", keep: { first: "Ryan",     last: "Lentz"  }, newPartner: { first: "Katy",      last: "Lentz"  } },
  { shortId: "5d9d6499", keep: { first: "James",    last: "Hall"   }, newPartner: { first: "Stephanie", last: "Hall"   } },
  { shortId: "e8ccea43", keep: { first: "Steven",   last: "Mills"  }, newPartner: { first: "Tori",      last: "Mills"  } },
  { shortId: "e7f9c223", keep: { first: "Marta",    last: "Pena"   }, newPartner: { first: "Marco",     last: "Pena"   } },
];

const DELETE_SHORTS = [
  "7589f786", // Sales Inquiries (default) — sales@caliper.com
  "5581590e", // Naf Austin Tx, East — austineast@newagainhouses.com
];

const CASING_FIXES: Rename[] = [
  { shortId: "3c179054", first: "Donna",         last: "O'Brien" },
  { shortId: "7f655b70", first: "Dan",           last: "D'Alessio" },
  { shortId: "6bdad036", first: "D'Anntoinette", last: "Jones" },
];

// ── Helpers ──────────────────────────────────────────────────────────

async function applyRenames(
  renames: Rename[], byShort: Map<string, Contact>, label: string, dry: boolean,
): Promise<void> {
  console.log(`\n═══ ${label} ═══\n`);
  for (const r of renames) {
    const c = byShort.get(r.shortId);
    if (!c) { console.log(`  [skip] ${r.shortId} not found`); continue; }
    const before = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
    console.log(`  ${c.id.slice(0, 8)}  ${before.padEnd(45)} → ${r.first} ${r.last}`);
    if (!dry) {
      const { error } = await supabase
        .from("contacts")
        .update({ first_name: r.first, last_name: r.last })
        .eq("id", c.id);
      if (error) console.log(`    ERR ${error.message}`);
    }
  }
}

/** Look up the journey(s) this contact is primary of; we'll add the new
 *  partner to each as co_primary. */
async function partnerJourneys(contactId: string): Promise<string[]> {
  const { data } = await supabase.from("journeys").select("id").eq("primary_contact_id", contactId);
  return (data ?? []).map((j) => j.id);
}

async function applySplits(
  byShort: Map<string, Contact>, dry: boolean,
): Promise<void> {
  console.log(`\n═══ SPLIT PARTNERSHIPS ═══\n`);
  for (const sp of SPLITS) {
    const c = byShort.get(sp.shortId);
    if (!c) { console.log(`  [skip] ${sp.shortId} not found`); continue; }
    const before = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
    console.log(`\n── ${before} (${c.id.slice(0, 8)})`);
    const journeys = await partnerJourneys(c.id);
    console.log(`   keep  → ${sp.keep.first} ${sp.keep.last}  (existing contact)`);
    console.log(`   new   → ${sp.newPartner.first} ${sp.newPartner.last}  (co_primary of ${journeys.length} journey${journeys.length === 1 ? "" : "s"})`);

    if (dry) continue;

    // 1. Rename the existing row to the first partner.
    const { error: renErr } = await supabase
      .from("contacts")
      .update({ first_name: sp.keep.first, last_name: sp.keep.last })
      .eq("id", c.id);
    if (renErr) { console.log(`   ERR rename ${renErr.message}`); continue; }

    // 2. Create the second-partner contact with a synthetic ghl id so the
    //    NOT NULL UNIQUE constraint is satisfied. They can be connected to
    //    a real GHL contact later.
    const newGhlId = `split_${crypto.randomBytes(8).toString("hex")}`;
    const { data: inserted, error: insErr } = await supabase
      .from("contacts")
      .insert({
        ghl_contact_id: newGhlId,
        first_name: sp.newPartner.first,
        last_name: sp.newPartner.last,
      })
      .select("id")
      .single();
    if (insErr || !inserted) { console.log(`   ERR insert ${insErr?.message ?? "no row"}`); continue; }
    console.log(`   created new contact ${inserted.id.slice(0, 8)}  ghl=${newGhlId}`);

    // 3. Add the new partner as co_primary to every journey the keep owns.
    for (const jid of journeys) {
      const { error: jcErr } = await supabase.from("journey_contacts").insert({
        journey_id: jid,
        contact_id: inserted.id,
        role: "co_primary",
      });
      if (jcErr) console.log(`   journey_contacts ERR ${jcErr.message}`);
      else console.log(`   added to journey ${jid.slice(0, 8)} as co_primary`);
    }
  }
}

async function applyDeletes(byShort: Map<string, Contact>, dry: boolean): Promise<void> {
  console.log(`\n═══ DELETES ═══\n`);
  for (const short of DELETE_SHORTS) {
    const c = byShort.get(short);
    if (!c) { console.log(`  [skip] ${short} not found`); continue; }
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
    console.log(`  ${c.id.slice(0, 8)}  ${name}`);
    if (dry) continue;

    // FK attachments for these two are typically zero (junk rows), but
    // be thorough: drop any zombie journey, null out call_participants,
    // clean contact_emails, then delete.
    const { data: js } = await supabase.from("journeys").select("id").eq("primary_contact_id", c.id);
    for (const j of js ?? []) {
      await supabase.from("journeys").delete().eq("id", j.id);
    }
    await supabase.from("call_participants").update({ contact_id: null }).eq("contact_id", c.id);
    await supabase.from("contact_emails").delete().eq("contact_id", c.id);
    const { error } = await supabase.from("contacts").delete().eq("id", c.id);
    if (error) console.log(`    ERR ${error.message}`);
    else console.log(`    deleted`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(live: boolean): Promise<void> {
  const dry = !live;
  console.log(`Mode: ${live ? "LIVE" : "DRY RUN"}`);

  const all = await loadAll();
  const byShort = new Map<string, Contact>();
  for (const c of all) byShort.set(c.id.slice(0, 8), c);

  await applyRenames(NICKNAMES,    byShort, "FOLD NICKNAMES",       dry);
  await applyRenames(STRIP_PARENS, byShort, "STRIP LEAD-SOURCE TAGS", dry);
  await applySplits(byShort, dry);
  await applyDeletes(byShort, dry);
  await applyRenames(CASING_FIXES, byShort, "APOSTROPHE CASING",    dry);
}

void main(process.argv.includes("--live")).catch((e) => {
  console.error(e);
  process.exit(1);
});
