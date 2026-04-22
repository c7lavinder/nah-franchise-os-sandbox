/**
 * Clean up 5 same-person duplicate contact groups where email+phone match.
 * For each pair: pick the row with more activity as canonical, merge the
 * orphan's journey into the canonical's journey, then delete the orphan.
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
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const DRY = !process.argv.includes("--apply");
const tag = () => DRY ? "[DRY]" : "[LIVE]";

interface Row { id: string; ghl_contact_id: string; email: string | null; phone: string | null }
interface Refs { j_primary: number; j_member: number; cps: number; ext: number; acts: number; crp: number; crp_linked: number }

async function countRefs(id: string): Promise<Refs> {
  const pairs = await Promise.all([
    s.from("journeys").select("*", { count: "exact", head: true }).eq("primary_contact_id", id),
    s.from("journey_contacts").select("*", { count: "exact", head: true }).eq("contact_id", id),
    s.from("contact_pipeline_state").select("*", { count: "exact", head: true }).eq("contact_id", id),
    s.from("call_data_extractions").select("*", { count: "exact", head: true }).eq("contact_id", id),
    s.from("call_action_items").select("*", { count: "exact", head: true }).eq("contact_id", id),
    s.from("contact_related_people").select("*", { count: "exact", head: true }).eq("contact_id", id),
    s.from("contact_related_people").select("*", { count: "exact", head: true }).eq("linked_contact_id", id),
  ]);
  return { j_primary: pairs[0].count ?? 0, j_member: pairs[1].count ?? 0, cps: pairs[2].count ?? 0,
    ext: pairs[3].count ?? 0, acts: pairs[4].count ?? 0, crp: pairs[5].count ?? 0, crp_linked: pairs[6].count ?? 0 };
}

function activityScore(r: Refs): number {
  return r.ext * 10 + r.acts * 5 + r.cps * 3 + r.crp + r.crp_linked;
}

async function getJourney(primaryId: string): Promise<{ id: string } | null> {
  const { data } = await s.from("journeys").select("id").eq("primary_contact_id", primaryId).eq("status", "active").maybeSingle();
  return data;
}

async function reassign(table: string, field: string, from: string, to: string): Promise<void> {
  console.log(`${tag()}  reassign ${table}.${field}: ${from.slice(0,8)} → ${to.slice(0,8)}`);
  if (DRY) return;
  const { error } = await s.from(table).update({ [field]: to }).eq(field, from);
  if (error && /duplicate/.test(String(error.message ?? error))) {
    console.log(`    conflict → delete instead`);
    const { error: dErr } = await s.from(table).delete().eq(field, from);
    if (dErr) throw new Error(`${table}.${field}: ${JSON.stringify(dErr)}`);
  } else if (error) {
    throw new Error(`${table}.${field}: ${JSON.stringify(error)}`);
  }
}

async function mergeOrphanIntoCanonical(canonical: Row, orphan: Row): Promise<void> {
  console.log(`\n  orphan ${orphan.id.slice(0,8)} (${orphan.email ?? "—"}) → canonical ${canonical.id.slice(0,8)}`);

  const canonicalJourney = await getJourney(canonical.id);
  const orphanJourney = await getJourney(orphan.id);

  // If orphan has a journey, merge it into canonical's journey (or transfer ownership if canonical has none).
  if (orphanJourney && canonicalJourney && orphanJourney.id !== canonicalJourney.id) {
    // Migrate child rows of orphanJourney → canonicalJourney, then delete orphan journey.
    await reassign("call_data_extractions", "journey_id", orphanJourney.id, canonicalJourney.id);
    await reassign("call_action_items", "journey_id", orphanJourney.id, canonicalJourney.id);
    // Move pipeline_state rows (may conflict on unique index; handle via delete-conflicting).
    await reassign("journey_pipeline_state", "journey_id", orphanJourney.id, canonicalJourney.id);
    // Wipe journey_contacts on orphan journey — canonical journey already has the primary.
    console.log(`${tag()}  delete journey_contacts where journey_id=${orphanJourney.id.slice(0,8)}`);
    if (!DRY) await s.from("journey_contacts").delete().eq("journey_id", orphanJourney.id);
    // Delete orphan journey.
    console.log(`${tag()}  delete journey ${orphanJourney.id.slice(0,8)}`);
    if (!DRY) {
      const { error } = await s.from("journeys").delete().eq("id", orphanJourney.id);
      if (error) throw new Error(`delete orphan journey: ${JSON.stringify(error)}`);
    }
  } else if (orphanJourney && !canonicalJourney) {
    // Canonical has no journey — just transfer ownership.
    console.log(`${tag()}  reassign journeys.primary_contact_id: ${orphan.id.slice(0,8)} → ${canonical.id.slice(0,8)}`);
    if (!DRY) {
      const { error } = await s.from("journeys").update({ primary_contact_id: canonical.id }).eq("id", orphanJourney.id);
      if (error) throw new Error(`reassign journey: ${JSON.stringify(error)}`);
    }
  }

  // Migrate all contact-level references from orphan → canonical.
  // Note: contact_pipeline_state was dropped in an earlier migration and
  // no longer exists; journey-level state lives in journey_pipeline_state.
  for (const [table, field] of [
    ["journey_contacts", "contact_id"],
    ["call_data_extractions", "contact_id"],
    ["call_action_items", "contact_id"],
    ["contact_related_people", "contact_id"],
    ["contact_related_people", "linked_contact_id"],
  ] as const) {
    await reassign(table, field, orphan.id, canonical.id);
  }

  console.log(`${tag()}  delete contact ${orphan.id.slice(0,8)}`);
  if (!DRY) {
    const { error } = await s.from("contacts").delete().eq("id", orphan.id);
    if (error) throw new Error(`delete contact: ${JSON.stringify(error)}`);
  }
}

async function dedupeGroup(rows: Row[], label: string): Promise<void> {
  if (rows.length < 2) { console.log(`skip ${label}: ${rows.length} rows`); return; }
  console.log(`\n═══ ${label}: ${rows.length} rows ═══`);
  const scored = await Promise.all(rows.map(async (r) => ({ row: r, refs: await countRefs(r.id) })));
  scored.sort((a, b) => activityScore(b.refs) - activityScore(a.refs));
  const canonical = scored[0].row;
  console.log(`  canonical ${canonical.id.slice(0,8)} (activity ${activityScore(scored[0].refs)}, refs ${JSON.stringify(scored[0].refs)})`);
  for (const orphan of scored.slice(1)) {
    console.log(`  orphan ${orphan.row.id.slice(0,8)} refs ${JSON.stringify(orphan.refs)}`);
    await mergeOrphanIntoCanonical(canonical, orphan.row);
  }
}

async function byName(first: string, last: string): Promise<Row[]> {
  const { data } = await s.from("contacts").select("id, ghl_contact_id, email, phone").eq("first_name", first).eq("last_name", last);
  return (data as Row[]) ?? [];
}
async function byEmail(email: string): Promise<Row[]> {
  const { data } = await s.from("contacts").select("id, ghl_contact_id, email, phone").eq("email", email);
  return (data as Row[]) ?? [];
}

async function main() {
  console.log(DRY ? "DRY RUN" : "LIVE RUN");
  await dedupeGroup(await byName("Wendy", "Gardiner"), "Wendy Gardiner");
  await dedupeGroup(await byName("Robb", "Robberts"), "Robb Robberts");
  await dedupeGroup(await byName("Deann", "Denny"), "Deann Denny");
  await dedupeGroup(await byName("Tres", "Pigg"), "Tres Pigg");
  await dedupeGroup(await byEmail("franchisees@newagainhouses.com"), "franchisees@newagainhouses.com");
}
void main();
