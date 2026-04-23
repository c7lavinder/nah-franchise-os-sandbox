/**
 * Merge 14 same-name contact pairs surfaced by the Apr 23 audit.
 *
 * Many franchisees have two contact rows — one on their personal email
 * (gmail/yahoo/aol) from when they were a lead, and one on their
 * @newagainhouses.com address created when they became a franchisee. The
 * dedupe pattern is always the same: pick the @newagainhouses.com record
 * as canonical (active franchisee identity), absorb the personal email
 * into contact_emails, and move every FK reference to the canonical side.
 *
 * A few pairs look like both rows are on personal emails (no @nah) or
 * have a bad phone/email on one side. For those, the most-recently-
 * updated row wins.
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

/** Short IDs from the audit — first element of each pair is preferred canonical hint. */
const PAIRS: Array<[string, string]> = [
  ["7945130f", "ea581237"], // John Adams — canonical: jadams@newagainhouses.com
  ["32f2e1a9", "08987dda"], // Chris Lopez
  ["8727d351", "e5a76e19"], // Latoya Johnson
  ["24f20b89", "a8f04d3f"], // Brandon Brewer
  ["c8ade8f0", "2bbb4b87"], // Bernard Craig
  ["eb50d5bd", "ad4955cc"], // Derek King
  ["390bc420", "a2ae438a"], // Angel Lane
  ["75161b8e", "9f85384d"], // Melodi Ferrer
  ["97292899", "837876b5"], // Larry Rife — canonical: lrife@newagainhouses.com
  ["d4245eb7", "cadea67b"], // Ryan Norman — canonical: rnorman@newagainhouses.com
  ["9f3098c5", "fff14e39"], // Alex Inanc — canonical: ainanc@newagainhouses.com
  ["ccc268f6", "537b3b41"], // Kernsky Joseph
  ["dc997e99", "ae8d1c99"], // Naegelle McKenzie-ross
  ["42109854", "ee536f97"], // Alimon Williams
];

interface Contact {
  id: string;
  ghl_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  address: string | null;
  opportunity_source: string | null;
  notes: string | null;
  is_converted_franchisee: boolean | null;
  updated_at: string;
  created_at: string;
}

async function loadAll(): Promise<Contact[]> {
  const PAGE = 1000;
  const out: Contact[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name, email, phone, city, state, zip, address, opportunity_source, notes, is_converted_franchisee, updated_at, created_at")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as Contact[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

function pickCanonical(a: Contact, b: Contact): { keep: Contact; drop: Contact } {
  const aNah = (a.email ?? "").toLowerCase().endsWith("@newagainhouses.com");
  const bNah = (b.email ?? "").toLowerCase().endsWith("@newagainhouses.com");
  if (aNah && !bNah) return { keep: a, drop: b };
  if (bNah && !aNah) return { keep: b, drop: a };

  // Neither (or both) are @nah — prefer the converted-franchisee flag, else
  // the most recent update, else whichever has a non-null phone/email.
  if (a.is_converted_franchisee && !b.is_converted_franchisee) return { keep: a, drop: b };
  if (b.is_converted_franchisee && !a.is_converted_franchisee) return { keep: b, drop: a };

  const scoreA = (a.phone ? 1 : 0) + (a.email ? 1 : 0);
  const scoreB = (b.phone ? 1 : 0) + (b.email ? 1 : 0);
  if (scoreA !== scoreB) return scoreA > scoreB ? { keep: a, drop: b } : { keep: b, drop: a };

  return a.updated_at >= b.updated_at ? { keep: a, drop: b } : { keep: b, drop: a };
}

/**
 * Tables that reference contacts and must be re-pointed at the canonical
 * side before the dropped row can be deleted. Each entry names the FK
 * column and whether it stores a local UUID ("contact_id") or the
 * GHL string id ("ghl_contact_id"). uniqueCols, when set, warns the
 * row-mover to drop collisions instead of erroring.
 */
interface FkMove {
  table: string;
  fkColumn: string;
  fkType: "contact_id" | "ghl_contact_id";
  uniqueCols?: string[];
}

const FK_MOVES: FkMove[] = [
  { table: "journey_contacts",         fkColumn: "contact_id",            fkType: "contact_id", uniqueCols: ["journey_id", "contact_id"] },
  { table: "journeys",                 fkColumn: "primary_contact_id",    fkType: "contact_id" },
  { table: "contact_related_people",   fkColumn: "contact_id",            fkType: "contact_id" },
  { table: "contact_related_people",   fkColumn: "linked_contact_id",     fkType: "contact_id" },
  { table: "contact_team_members",     fkColumn: "contact_id",            fkType: "contact_id" },
  { table: "contact_profile_fields",   fkColumn: "contact_id",            fkType: "contact_id", uniqueCols: ["contact_id", "field_slug"] },
  { table: "contact_activity_messages",fkColumn: "contact_id",            fkType: "contact_id" },
  { table: "calls",                    fkColumn: "contact_id",            fkType: "contact_id" },
  { table: "call_participants",        fkColumn: "contact_id",            fkType: "contact_id" },
  { table: "call_review_packages",     fkColumn: "contact_id",            fkType: "contact_id" },
  { table: "embeddings",               fkColumn: "contact_id",            fkType: "contact_id" },
  { table: "notifications",            fkColumn: "contact_id",            fkType: "contact_id" },
  { table: "ghl_sync_queue",           fkColumn: "contact_id",            fkType: "contact_id" },
  { table: "ghl_action_drafts",        fkColumn: "contact_id",            fkType: "contact_id" },

  // ghl string-id references
  { table: "territory_owners",         fkColumn: "ghl_contact_id",        fkType: "ghl_contact_id" },
  { table: "contact_scores",           fkColumn: "ghl_contact_id",        fkType: "ghl_contact_id" },
];

async function moveFkRows(
  db: SupabaseClient, move: FkMove, fromValue: string, toValue: string, dryRun: boolean,
): Promise<{ moved: number; skippedCollision: number; error?: string }> {
  const col = move.fkColumn;

  const { data: rows, error } = await db
    .from(move.table).select("*").eq(col, fromValue);
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
      // Table without an id primary key — update by the FK value directly.
      const res = await db.from(move.table).update({ [col]: toValue }).eq(col, fromValue);
      upErr = res.error;
    }
    if (upErr) return { moved, skippedCollision: skipped, error: `${move.table}: ${upErr.message}` };
    moved += 1;
  }
  return { moved, skippedCollision: skipped };
}

async function mergePair(
  short1: string, short2: string, byShort: Map<string, Contact>, dryRun: boolean,
): Promise<void> {
  const a = byShort.get(short1);
  const b = byShort.get(short2);
  if (!a || !b) {
    console.log(`  [skip] ${short1} or ${short2} not found`);
    return;
  }

  const { keep, drop } = pickCanonical(a, b);
  console.log(`\n── ${keep.first_name} ${keep.last_name} ──`);
  console.log(`   keep  ${keep.id.slice(0, 8)}  email=${keep.email}  ghl=${keep.ghl_contact_id ?? "—"}`);
  console.log(`   drop  ${drop.id.slice(0, 8)}  email=${drop.email}  ghl=${drop.ghl_contact_id ?? "—"}`);

  // 1. Absorb dropped contact's email as a secondary on the keeper.
  if (drop.email) {
    if (dryRun) {
      console.log(`   would add secondary email ${drop.email} to ${keep.id.slice(0, 8)}`);
    } else {
      const { error: emErr } = await supabase
        .from("contact_emails")
        .insert({
          contact_id: keep.id,
          email: drop.email,
          is_primary: false,
          source: "merge",
        });
      if (emErr && !emErr.message.includes("duplicate")) {
        console.log(`   email-add ERR: ${emErr.message}`);
      } else {
        console.log(`   absorbed email ${drop.email}`);
      }
    }
  }

  // 2. Move FKs from drop → keep.
  for (const move of FK_MOVES) {
    const fromValue = move.fkType === "ghl_contact_id" ? drop.ghl_contact_id : drop.id;
    const toValue = move.fkType === "ghl_contact_id" ? keep.ghl_contact_id : keep.id;
    if (!fromValue || !toValue) continue;
    const result = await moveFkRows(supabase, move, fromValue, toValue, dryRun);
    if (result.moved > 0 || result.skippedCollision > 0 || result.error) {
      const prefix = dryRun ? "would move" : "moved";
      console.log(`   ${prefix} ${move.table}.${move.fkColumn}: ${result.moved}${result.skippedCollision ? ` (+${result.skippedCollision} collisions resolved)` : ""}${result.error ? ` — ERR ${result.error}` : ""}`);
    }
  }

  // 3. Also copy any contact_emails rows from drop over, then delete drop.
  if (!dryRun) {
    const { data: dropEmails } = await supabase
      .from("contact_emails")
      .select("email, label")
      .eq("contact_id", drop.id);
    for (const e of dropEmails ?? []) {
      const { error: copyErr } = await supabase.from("contact_emails").insert({
        contact_id: keep.id, email: e.email, is_primary: false, label: e.label, source: "merge",
      });
      if (copyErr && !copyErr.message.includes("duplicate")) {
        console.log(`   email-copy ERR: ${copyErr.message}`);
      }
    }
    // Remove the dropped contact's emails before the cascade, so the trigger
    // doesn't try to promote a survivor that we're about to move.
    await supabase.from("contact_emails").delete().eq("contact_id", drop.id);

    const { error: delErr } = await supabase.from("contacts").delete().eq("id", drop.id);
    if (delErr) {
      console.log(`   DELETE drop ERR: ${delErr.message}`);
    } else {
      console.log(`   deleted drop ${drop.id.slice(0, 8)}`);
    }
  } else {
    console.log(`   would delete drop ${drop.id.slice(0, 8)}`);
  }
}

async function main(live: boolean): Promise<void> {
  console.log(`Mode: ${live ? "LIVE" : "DRY RUN"}\n`);
  const all = await loadAll();
  const byShort = new Map<string, Contact>();
  for (const c of all) byShort.set(c.id.slice(0, 8), c);

  for (const [a, b] of PAIRS) {
    await mergePair(a, b, byShort, !live);
  }
}

void main(process.argv.includes("--live")).catch((e) => {
  console.error(e);
  process.exit(1);
});
