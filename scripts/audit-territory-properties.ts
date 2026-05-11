/**
 * Audit: compare property counts per territory between MasterSuite and Supabase.
 * Checks ms_properties, ms_property_calculations, ms_property_inventory.
 * Run: npx tsx scripts/audit-territory-properties.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { queryMS } from "../lib/mastersuite/client";
import { getServiceSupabase } from "../lib/mastersuite/supabase";

async function main() {
  const sb = getServiceSupabase();

  // 1. MasterSuite property counts per territory (non-Lead-List, non-archived)
  const msCounts = await queryMS<{ TerritorySlug: string; cnt: number }>(`
    SELECT TerritorySlug, COUNT(*) as cnt
    FROM PropertySummaries
    WHERE Archived = 0 AND Status != '0 Lead List'
    GROUP BY TerritorySlug
    ORDER BY TerritorySlug
  `);

  // 2. MasterSuite total properties (all)
  const msTotal = await queryMS<{ total: number }>(`
    SELECT COUNT(*) as total FROM PropertySummaries WHERE Archived = 0 AND Status != '0 Lead List'
  `);

  // 3. MasterSuite inventory counts per territory
  const msInvCounts = await queryMS<{ TerritorySlug: string; cnt: number }>(`
    SELECT ps.TerritorySlug, COUNT(*) as cnt
    FROM PropertyInventory pi
    JOIN PropertySummaries ps ON pi.PropertyId = ps.PropertyId
    WHERE ps.Archived = 0
    GROUP BY ps.TerritorySlug
    ORDER BY ps.TerritorySlug
  `);

  // 4. Supabase property counts per territory
  const { data: supaCounts, error: e1 } = await sb.rpc("get_property_counts_by_territory");

  // If RPC doesn't exist, do it manually
  let supaPropertyMap: Map<string, number>;
  let supaCalcMap: Map<string, number>;
  let supaInvMap: Map<string, number>;

  // Properties
  const { count: supaTotalProps } = await sb.from("ms_properties").select("PropertyId", { count: "exact", head: true });

  // Get territory counts via a query
  const { data: supaProps } = await sb.from("ms_properties").select("TerritorySlug").not("TerritorySlug", "is", null);

  supaPropertyMap = new Map<string, number>();
  for (const row of (supaProps || []) as { TerritorySlug: string }[]) {
    supaPropertyMap.set(row.TerritorySlug, (supaPropertyMap.get(row.TerritorySlug) || 0) + 1);
  }

  // Calculations
  const { count: supaTotalCalcs } = await sb
    .from("ms_property_calculations")
    .select("PropertyId", { count: "exact", head: true });

  // Inventory
  const { count: supaTotalInv } = await sb
    .from("ms_property_inventory")
    .select("PropertyId", { count: "exact", head: true });

  // Get inventory by territory via join
  const { data: supaInvData } = await sb
    .from("ms_property_inventory")
    .select("PropertyId, ms_properties!inner(TerritorySlug)");

  supaInvMap = new Map<string, number>();
  for (const row of (supaInvData || []) as any[]) {
    const slug = row.ms_properties?.TerritorySlug;
    if (slug) supaInvMap.set(slug, (supaInvMap.get(slug) || 0) + 1);
  }

  // Status history
  const { count: supaTotalHist } = await sb
    .from("ms_property_status_history")
    .select("PropertyId", { count: "exact", head: true });

  console.log("=== PROPERTY DATA AUDIT ===\n");
  console.log(`MasterSuite total properties (non-Lead-List, non-archived): ${msTotal[0]?.total}`);
  console.log(`Supabase ms_properties:       ${supaTotalProps}`);
  console.log(`Supabase ms_property_calculations: ${supaTotalCalcs}`);
  console.log(`Supabase ms_property_inventory:    ${supaTotalInv}`);
  console.log(`Supabase ms_property_status_history: ${supaTotalHist}`);

  // Compare per territory
  const msMap = new Map(msCounts.map((r) => [r.TerritorySlug, r.cnt]));
  const msInvMap = new Map(msInvCounts.map((r) => [r.TerritorySlug, r.cnt]));

  const allSlugs = new Set([...msMap.keys(), ...supaPropertyMap.keys()]);
  const sorted = [...allSlugs].sort();

  console.log("\n--- PROPERTY COUNTS BY TERRITORY ---");
  console.log(
    "Slug".padEnd(15) +
      "MS Props".padEnd(12) +
      "Supa Props".padEnd(12) +
      "Diff".padEnd(8) +
      "MS Inv".padEnd(10) +
      "Supa Inv".padEnd(10) +
      "Inv Diff"
  );

  let totalMismatch = 0;
  let totalInvMismatch = 0;
  const mismatches: string[] = [];

  for (const slug of sorted) {
    const msCount = msMap.get(slug) || 0;
    const supaCount = supaPropertyMap.get(slug) || 0;
    const diff = msCount - supaCount;
    const msInv = msInvMap.get(slug) || 0;
    const supaInv = supaInvMap.get(slug) || 0;
    const invDiff = msInv - supaInv;

    const flag = diff !== 0 || invDiff !== 0 ? " <<<" : "";
    if (diff !== 0 || invDiff !== 0) {
      totalMismatch++;
      if (diff !== 0) mismatches.push(`${slug}: MS=${msCount} Supa=${supaCount} diff=${diff}`);
    }
    if (invDiff !== 0) totalInvMismatch++;

    console.log(
      slug.padEnd(15) +
        String(msCount).padEnd(12) +
        String(supaCount).padEnd(12) +
        String(diff).padEnd(8) +
        String(msInv).padEnd(10) +
        String(supaInv).padEnd(10) +
        String(invDiff) +
        flag
    );
  }

  // Check for territories with properties in MS but no territory record in Supabase
  console.log("\n--- TERRITORIES WITH PROPERTIES IN MS BUT NO SUPABASE TERRITORY RECORD ---");
  const { data: supaTerritories } = await sb.from("territories").select("TerritorySlug");
  const supaTerrSet = new Set((supaTerritories || []).map((t: { TerritorySlug: string }) => t.TerritorySlug));

  for (const slug of msMap.keys()) {
    if (!supaTerrSet.has(slug)) {
      console.log(`  ${slug}: ${msMap.get(slug)} properties in MS, no territory record in Supabase`);
    }
  }

  // Check last sync times
  console.log("\n--- SYNC FRESHNESS ---");
  const { data: latestSync } = await sb
    .from("ms_properties")
    .select("ms_synced_at")
    .order("ms_synced_at", { ascending: false })
    .limit(1);

  const { data: oldestSync } = await sb
    .from("ms_properties")
    .select("ms_synced_at")
    .order("ms_synced_at", { ascending: true })
    .limit(1);

  console.log(`Most recent sync: ${latestSync?.[0]?.ms_synced_at}`);
  console.log(`Oldest sync:      ${oldestSync?.[0]?.ms_synced_at}`);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Territories with property count mismatches: ${totalMismatch}`);
  console.log(`Territories with inventory count mismatches: ${totalInvMismatch}`);

  if (mismatches.length > 0) {
    console.log("\nProperty mismatches:");
    for (const m of mismatches) console.log(`  ${m}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
