/**
 * Safe contact-cleanup pass surfaced by scripts/contact-cleanup-audit.ts.
 *
 * Actions:
 *   A. Delete rows that aren't real people (4 Unknown Contacts, Google
 *      Calendar resource, "501 Alabama" property email, "Franchisees"
 *      group alias).
 *   B. Rename rows whose names are wrong or sloppy — title-case six
 *      lowercase entries, split "Juneherold" into June Herold, and
 *      normalize "Rekh Sha" to proper first/last.
 *
 * Pre-flight: prints each target's FK attachment counts (journeys,
 * journey_contacts, calls, contact_pipeline_state) so we can see the
 * blast radius of any cascade before --live.
 *
 * Usage:
 *   npx tsx scripts/cleanup-contacts-apr23.ts         # dry run
 *   npx tsx scripts/cleanup-contacts-apr23.ts --live  # apply
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

// Short-IDs (first 8 chars of UUID) from the audit report.
const DELETE_SHORTS = [
  "a2095a2f", "acd92c02", "cbed3cca", "7d17ce74", // 4 × Unknown Contact
  "f8ec9f66", // Google Calendar resource
  "528f25a9", // 501 Alabama property email
  "696fd9f4", // Franchisees group alias
];

interface Rename {
  shortId: string;
  first: string;
  last: string;
}

const RENAMES: Rename[] = [
  // 6 lowercase names → Title Case
  { shortId: "1362cf81", first: "Javier",  last: "Ybarra" },
  { shortId: "09b8fe10", first: "Jesse",   last: "Farewell" },
  { shortId: "6c554a4e", first: "Boom",    last: "Wilson" },
  { shortId: "09b74663", first: "Jasmine", last: "Toudle" },
  { shortId: "0f642134", first: "Willie",  last: "Williams" },
  { shortId: "5bb04feb", first: "Scottie", last: "Mcconico" },
  // Juneherold → June Herold
  { shortId: "1d412fa2", first: "June",    last: "Herold" },
  // Email-as-first-name → proper first/last
  { shortId: "0842b0b6", first: "Rekha",   last: "Sha" },
];

async function loadAll(): Promise<Contact[]> {
  const PAGE = 1000;
  const out: Contact[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as Contact[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function fkImpact(contactId: string): Promise<{
  counts: Record<string, number>;
  journeyIds: string[];
}> {
  const counts: Record<string, number> = {};

  const { data: journeys } = await supabase
    .from("journeys")
    .select("id, name")
    .eq("primary_contact_id", contactId);
  counts["journeys (primary)"] = journeys?.length ?? 0;
  const journeyIds = (journeys ?? []).map((j) => j.id);

  for (const [label, q] of [
    ["journey_contacts (active)", supabase.from("journey_contacts").select("id", { count: "exact", head: true }).eq("contact_id", contactId).is("left_at", null)],
    ["calls", supabase.from("calls").select("id", { count: "exact", head: true }).eq("contact_id", contactId)],
    ["contact_pipeline_state", supabase.from("contact_pipeline_state").select("id", { count: "exact", head: true }).eq("contact_id", contactId)],
    ["call_participants", supabase.from("call_participants").select("id", { count: "exact", head: true }).eq("contact_id", contactId)],
  ] as const) {
    const { count } = (await q) as { count: number | null };
    counts[label] = count ?? 0;
  }
  return { counts, journeyIds };
}

function fmt(c: Contact): string {
  const n = [c.first_name, c.last_name].filter(Boolean).join(" ") || "(no name)";
  return `${c.id.slice(0, 8)}  ${n.padEnd(32)}  email=${c.email ?? "null"}`;
}

async function main(live: boolean): Promise<void> {
  console.log(`Mode: ${live ? "LIVE" : "DRY RUN"}\n`);
  const all = await loadAll();
  const byShort = new Map<string, Contact>();
  for (const c of all) byShort.set(c.id.slice(0, 8), c);

  const resolveShort = (s: string): Contact | null => byShort.get(s) ?? null;

  // ── Deletes ────────────────────────────────────────────────────────────
  console.log("═══ DELETES ═══\n");
  const deleteTargets: Array<{ contact: Contact; journeyIds: string[] }> = [];
  for (const short of DELETE_SHORTS) {
    const c = resolveShort(short);
    if (!c) {
      console.log(`  [skip] ${short} not found`);
      continue;
    }
    const { counts, journeyIds } = await fkImpact(c.id);
    const totalFk = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(fmt(c));
    console.log(`    attachments: ${JSON.stringify(counts)}${totalFk > 0 ? "   ⚠️" : ""}`);
    if (journeyIds.length > 0) {
      console.log(`    zombie journeys to drop first: ${journeyIds.join(", ")}`);
    }
    deleteTargets.push({ contact: c, journeyIds });
  }

  // ── Renames ────────────────────────────────────────────────────────────
  console.log("\n═══ RENAMES ═══\n");
  const renameTargets: Array<{ contact: Contact; rename: Rename }> = [];
  for (const r of RENAMES) {
    const c = resolveShort(r.shortId);
    if (!c) {
      console.log(`  [skip] ${r.shortId} not found`);
      continue;
    }
    console.log(`${fmt(c)}`);
    console.log(`    → first="${r.first}" last="${r.last}"`);
    renameTargets.push({ contact: c, rename: r });
  }

  if (!live) {
    console.log("\n(dry run — no writes)");
    return;
  }

  // ── Execute ────────────────────────────────────────────────────────────
  console.log("\n═══ EXECUTING ═══\n");

  for (const { contact, journeyIds } of deleteTargets) {
    // 1. Drop zombie journeys first (cascade removes journey_contacts + jps).
    for (const jid of journeyIds) {
      const { error } = await supabase.from("journeys").delete().eq("id", jid);
      if (error) console.log(`  JOURNEY DELETE FAIL ${jid}: ${error.message}`);
      else console.log(`  dropped journey ${jid.slice(0, 8)}`);
    }
    // 2. Null out any call_participants references (SET NULL is already the
    //    cascade, but be explicit for idempotence).
    await supabase.from("call_participants").update({ contact_id: null }).eq("contact_id", contact.id);
    // 3. Delete the contact itself.
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    if (error) console.log(`  DELETE FAIL ${contact.id.slice(0, 8)}: ${error.message}`);
    else console.log(`  deleted contact ${contact.id.slice(0, 8)}`);
  }

  for (const { contact, rename } of renameTargets) {
    const { error } = await supabase
      .from("contacts")
      .update({ first_name: rename.first, last_name: rename.last })
      .eq("id", contact.id);
    if (error) console.log(`  RENAME FAIL ${contact.id.slice(0, 8)}: ${error.message}`);
    else console.log(`  renamed  ${contact.id.slice(0, 8)} → ${rename.first} ${rename.last}`);
  }
}

void main(process.argv.includes("--live")).catch((e) => {
  console.error(e);
  process.exit(1);
});
