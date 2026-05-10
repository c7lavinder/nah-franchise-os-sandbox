/**
 * Pre-flight audit for the contacts → journeys restructure.
 *
 * Read-only against production. Prints every expected migration outcome so we
 * can eyeball before running the real backfill. No writes.
 *
 *   npx tsx scripts/audit-journey-migration.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface ContactRow {
  id: string;
  ghl_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  is_converted_franchisee: boolean | null;
}
interface CpsRow {
  id: string;
  contact_id: string;
  pipeline_id: string;
  current_stage_id: string;
  is_active: boolean;
}
interface OwnerRow {
  ghl_contact_id: string;
  TerritorySlug: string;
  end_date: string | null;
}
interface StageRow {
  id: string;
  name: string;
  pipeline_id: string;
}
interface PipelineRow {
  id: string;
  slug: string;
  name: string;
}
interface RelatedRow {
  contact_id: string;
  linked_contact_id: string | null;
  role: string;
}

function hdr(title: string) {
  console.log(`\n━━ ${title} ━━`);
}

// PostgREST caps selects at 1000 rows; paginate everything.
async function fetchAll<T>(
  table: string,
  select: string,
  filter?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    let q = supabase.from(table).select(select);
    if (filter) q = filter(q) as typeof q;
    const { data, error } = await q.range(offset, offset + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as T[]));
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

async function main() {
  const [contactList, cpsList, ownerList, stageList, pipelineList, relatedList] = await Promise.all([
    fetchAll<ContactRow>("contacts", "id, ghl_contact_id, first_name, last_name, is_converted_franchisee"),
    fetchAll<CpsRow>("contact_pipeline_state", "id, contact_id, pipeline_id, current_stage_id, is_active"),
    fetchAll<OwnerRow>("territory_owners", "ghl_contact_id, TerritorySlug, end_date"),
    fetchAll<StageRow>("pipeline_stages", "id, name, pipeline_id"),
    fetchAll<PipelineRow>("pipelines", "id, slug, name"),
    fetchAll<RelatedRow>("contact_related_people", "contact_id, linked_contact_id, role", (q) =>
      q.is("deleted_at", null)
    ),
  ]);

  const contactById = new Map(contactList.map((c) => [c.id, c]));
  const stageById = new Map(stageList.map((s) => [s.id, s]));
  const pipelineById = new Map(pipelineList.map((p) => [p.id, p]));
  const activeOwners = ownerList.filter((o) => o.end_date === null);
  const ownersByGhl = new Map<string, string[]>();
  for (const o of activeOwners) {
    const list = ownersByGhl.get(o.ghl_contact_id) ?? [];
    list.push(o.TerritorySlug);
    ownersByGhl.set(o.ghl_contact_id, list);
  }

  hdr("1 · Baseline cards per stage (contact_pipeline_state, is_active=true)");
  const activeCps = cpsList.filter((r) => r.is_active);
  const stageCounts = new Map<string, number>();
  for (const r of activeCps) {
    const s = stageById.get(r.current_stage_id);
    const p = s ? pipelineById.get(s.pipeline_id) : null;
    const key = `${p?.slug ?? "?"} / ${s?.name ?? "?"}`;
    stageCounts.set(key, (stageCounts.get(key) ?? 0) + 1);
  }
  for (const [k, v] of [...stageCounts.entries()].sort()) console.log(`  ${k.padEnd(50)} ${v}`);
  console.log(`  Total active pipeline rows: ${activeCps.length}`);

  hdr("2 · Role classification per contact (derived)");
  let countProspect = 0,
    countFranchisee = 0,
    countSupport = 0;
  const roleFlips: ContactRow[] = []; // is_converted_franchisee wrong/missing
  const noGhl: ContactRow[] = [];
  for (const c of contactList) {
    const hasActivePipeline = activeCps.some((r) => r.contact_id === c.id);
    const ownsTerritory = !!c.ghl_contact_id && (ownersByGhl.get(c.ghl_contact_id)?.length ?? 0) > 0;
    const role = ownsTerritory || c.is_converted_franchisee ? "franchisee" : hasActivePipeline ? "prospect" : "support";
    if (role === "prospect") countProspect++;
    else if (role === "franchisee") countFranchisee++;
    else countSupport++;
    if (ownsTerritory && !c.is_converted_franchisee) roleFlips.push(c);
    if (hasActivePipeline && !c.ghl_contact_id) noGhl.push(c);
  }
  console.log(`  Prospects:    ${countProspect}`);
  console.log(`  Franchisees:  ${countFranchisee}`);
  console.log(`  Support:      ${countSupport}`);
  console.log(`  Total:        ${contactList.length}`);
  if (roleFlips.length > 0) {
    console.log(
      `\n  ⚠ ${roleFlips.length} contacts own a territory but is_converted_franchisee is NOT true — migration will set it:`
    );
    for (const c of roleFlips.slice(0, 20)) console.log(`    · ${c.first_name} ${c.last_name} (${c.id})`);
    if (roleFlips.length > 20) console.log(`    · ...and ${roleFlips.length - 20} more`);
  }
  if (noGhl.length > 0) {
    console.log(`\n  ⚠ ${noGhl.length} contacts in active pipelines with NO ghl_contact_id — flag before running:`);
    for (const c of noGhl.slice(0, 20)) console.log(`    · ${c.first_name} ${c.last_name} (${c.id})`);
  }

  hdr("3 · Co-primary merge candidates (business_partner + linked_contact_id)");
  const coPrimaryPairs = relatedList.filter((r) => r.role === "business_partner" && r.linked_contact_id);
  if (coPrimaryPairs.length === 0) {
    console.log("  None.");
  } else {
    for (const r of coPrimaryPairs) {
      const a = contactById.get(r.contact_id);
      const b = r.linked_contact_id ? contactById.get(r.linked_contact_id) : null;
      console.log(`  · ${a?.first_name ?? "?"} ${a?.last_name ?? ""} ⇔ ${b?.first_name ?? "?"} ${b?.last_name ?? ""}`);
    }
    console.log(
      `\n  These ${coPrimaryPairs.length} pairs will collapse into ${coPrimaryPairs.length} joint journeys (saving ${coPrimaryPairs.length} cards vs today).`
    );
  }

  hdr("4 · Multi-territory franchisees (will fan out to N cards)");
  const multiTerritory: { name: string; territories: string[]; cpsRowCount: number }[] = [];
  for (const c of contactList) {
    const slugs = c.ghl_contact_id ? (ownersByGhl.get(c.ghl_contact_id) ?? []) : [];
    if (slugs.length < 2) continue;
    const cpsCount = activeCps.filter((r) => r.contact_id === c.id).length;
    multiTerritory.push({
      name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.id,
      territories: slugs,
      cpsRowCount: cpsCount,
    });
  }
  if (multiTerritory.length === 0) {
    console.log("  None.");
  } else {
    let extraCards = 0;
    for (const m of multiTerritory) {
      const fanOut = Math.max(m.cpsRowCount, 1) * m.territories.length - m.cpsRowCount;
      extraCards += Math.max(fanOut, 0);
      console.log(
        `  · ${m.name}: ${m.territories.length} territories [${m.territories.join(", ")}] · current pipeline rows: ${m.cpsRowCount}`
      );
    }
    console.log(`\n  Runway stage will have +${extraCards} extra cards after migration.`);
  }

  hdr("5 · Other related-people links (spouse/advisor/etc — become journey_contacts leaves)");
  const leafLinks = relatedList.filter((r) => r.role !== "business_partner" && r.linked_contact_id);
  const leafByRole = new Map<string, number>();
  for (const r of leafLinks) leafByRole.set(r.role, (leafByRole.get(r.role) ?? 0) + 1);
  if (leafByRole.size === 0) console.log("  None.");
  for (const [role, n] of [...leafByRole.entries()].sort()) console.log(`  ${role.padEnd(20)} ${n}`);

  hdr("6 · Summary — expected outcome");
  const distinctPipelineContacts = new Set(cpsList.map((r) => r.contact_id)).size;
  const expectedJourneyCount = distinctPipelineContacts - coPrimaryPairs.length;
  console.log(`  Journeys to create:                      ${expectedJourneyCount}`);
  console.log(`  journey_contacts primary/co_primary rows: ${distinctPipelineContacts}`);
  console.log(`  journey_contacts leaf rows (linked):      ${leafLinks.length}`);
  console.log(
    `  journey_pipeline_state rows to create:    ${activeCps.length + multiTerritory.reduce((s, m) => s + Math.max(m.territories.length - 1, 0), 0)} (baseline ${activeCps.length} + multi-territory fan-out)`
  );
  console.log(`  is_converted_franchisee to flip true on:  ${roleFlips.length} contacts`);

  console.log("\n✔ Audit complete. Review above, then run the backfill migration.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
