/**
 * Fix territory alignment between NAH OS and MasterSuite.
 *
 * Actions:
 * 1. SLUG MIGRATIONS (3):
 *    - KISSMEE → KSSMEE (Omayra Mota) — move JPS rows, move owner, deactivate old slug
 *    - NORVM → NORVMI (Dale Rykse) — move JPS rows, move owner, deactivate old slug
 *    - RALNHC → RALHNC (Juan Camilo Varon) — move JPS rows, move owner, deactivate old slug
 *
 * 2. ASSIGN TERRITORY TO JPS (4):
 *    - ALCHUA → Jonathan Dreyer's journey (Setup stage JPS)
 *    - NOWTNJ → Ryan Rodriguez-Wiggins' journey (Setup stage JPS)
 *    - WICHTA → Jonathan Suda's journey (Setup stage JPS)
 *    - MONMTH → William Scott's journey (Setup stage JPS)
 *
 * 3. CREATE TERRITORY_OWNERS RECORDS (6):
 *    - ALCHUA → Jonathan Dreyer
 *    - KSSMEE → Omayra Mota (moved from KISSMEE)
 *    - MONMTH → William Scott
 *    - NOWTNJ → Ryan Rodriguez-Wiggins
 *    - SASOTA → Erik Spersrud
 *    - WICHTA → Jonathan Suda
 *
 * 4. ADD SASOTA JPS to Erik Spersrud's journey (new territory, keep INDYNW)
 *
 * Run: npx tsx scripts/fix-territory-alignment.ts [--dry-run]
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getServiceSupabase } from "../lib/mastersuite/supabase";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const sb = getServiceSupabase();
  const log = (msg: string) => console.log((DRY_RUN ? "[DRY RUN] " : "") + msg);

  if (DRY_RUN) console.log("\n*** DRY RUN MODE — no changes will be made ***\n");

  // ═══════════════════════════════════════════════════════════════
  // 1. SLUG MIGRATIONS
  // ═══════════════════════════════════════════════════════════════
  console.log("=== 1. SLUG MIGRATIONS ===\n");

  const slugMigrations = [
    {
      old: "KISSMEE",
      new: "KSSMEE",
      ownerGhl: "9amnHLaShzGtmoPQTebw",
      ownerName: "Omayra Mota",
    },
    {
      old: "NORVM",
      new: "NORVMI",
      ownerGhl: "uu5mL3i461LJlD0erxjz",
      ownerName: "Dale Rykse",
    },
    {
      old: "RALNHC",
      new: "RALHNC",
      ownerGhl: "W4BcaDWZ8bJkKsUXLjIf",
      ownerName: "Juan Camilo Varon",
    },
  ];

  for (const m of slugMigrations) {
    log(`Migrating ${m.old} → ${m.new} (${m.ownerName})`);

    // 1a. Update JPS rows from old slug to new slug
    const { data: jpsRows } = await sb
      .from("journey_pipeline_state")
      .select("id, TerritorySlug, journey_id, is_active")
      .eq("TerritorySlug", m.old);

    if (jpsRows?.length) {
      log(`  Found ${jpsRows.length} JPS rows on ${m.old}`);

      // Check for conflicts — if new slug already has JPS rows for same journey+pipeline combo
      // we need to deduplicate. For now, just check.
      const { data: existingNew } = await sb
        .from("journey_pipeline_state")
        .select("id, journey_id, pipeline_id, TerritorySlug, is_active, current_stage_id, pipeline_stages(name)")
        .eq("TerritorySlug", m.new);

      if (existingNew?.length) {
        log(`  WARNING: ${m.new} already has ${existingNew.length} JPS rows`);
        // If there's a duplicate (same journey, same active state), we should delete the old-slug ones
        for (const oldRow of jpsRows) {
          const duplicate = (existingNew as any[]).find(
            (n: any) => n.journey_id === oldRow.journey_id && n.is_active === oldRow.is_active
          );
          if (duplicate) {
            log(`  Deleting duplicate old-slug JPS ${oldRow.id} (journey has new-slug equivalent ${duplicate.id})`);
            if (!DRY_RUN) {
              // Delete stage_history referencing this JPS first
              await sb.from("stage_history").delete().eq("jps_id", oldRow.id);
              await sb.from("journey_pipeline_state").delete().eq("id", oldRow.id);
            }
          } else {
            log(`  Updating JPS ${oldRow.id} from ${m.old} → ${m.new}`);
            if (!DRY_RUN) {
              await sb.from("journey_pipeline_state").update({ TerritorySlug: m.new }).eq("id", oldRow.id);
            }
          }
        }
      } else {
        // No conflicts, just update all
        if (!DRY_RUN) {
          const { error } = await sb
            .from("journey_pipeline_state")
            .update({ TerritorySlug: m.new })
            .eq("TerritorySlug", m.old);
          if (error) log(`  ERROR updating JPS: ${error.message}`);
          else log(`  Updated ${jpsRows.length} JPS rows`);
        }
      }
    } else {
      log(`  No JPS rows on ${m.old}`);
    }

    // 1b. Move territory_owners from old to new
    const { data: oldOwners } = await sb
      .from("territory_owners")
      .select("id, TerritorySlug, ghl_contact_id, role, start_date")
      .eq("TerritorySlug", m.old);

    if (oldOwners?.length) {
      log(`  Moving ${oldOwners.length} owner records from ${m.old} → ${m.new}`);

      // Check if new slug already has an owner
      const { data: newOwners } = await sb
        .from("territory_owners")
        .select("id")
        .eq("TerritorySlug", m.new)
        .is("end_date", null);

      if (newOwners?.length) {
        log(`  ${m.new} already has active owner — deleting old-slug owner record`);
        if (!DRY_RUN) {
          await sb.from("territory_owners").delete().eq("TerritorySlug", m.old);
        }
      } else {
        if (!DRY_RUN) {
          // Create new owner record on correct slug, delete old
          for (const oo of oldOwners) {
            await sb.from("territory_owners").insert({
              TerritorySlug: m.new,
              ghl_contact_id: oo.ghl_contact_id,
              role: oo.role,
              start_date: oo.start_date,
            });
          }
          await sb.from("territory_owners").delete().eq("TerritorySlug", m.old);
        }
      }
    }

    // 1c. Update any call_territories, call_participants, extractions referencing old slug
    for (const table of ["call_territories", "call_data_extractions"]) {
      const col = table === "call_territories" ? "TerritorySlug" : "territory_tag";
      const { count } = await sb.from(table).select("id", { count: "exact", head: true }).eq(col, m.old);
      if (count && count > 0) {
        log(`  ${table}: ${count} rows referencing ${m.old}`);
        if (!DRY_RUN) {
          await sb
            .from(table)
            .update({ [col]: m.new })
            .eq(col, m.old);
        }
      }
    }

    // 1d. Deactivate old territory slug
    log(`  Deactivating ${m.old}`);
    if (!DRY_RUN) {
      await sb.from("territories").update({ status: "inactive" }).eq("TerritorySlug", m.old);
    }

    console.log();
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. ASSIGN TERRITORY TO JPS (null → correct slug)
  // ═══════════════════════════════════════════════════════════════
  console.log("=== 2. ASSIGN TERRITORY TO JOURNEY PIPELINE STATE ===\n");

  // Get the "Setup" stage id for the sales pipeline
  const { data: setupStage } = await sb
    .from("pipeline_stages")
    .select("id, name, pipeline_id")
    .eq("name", "Setup")
    .limit(5);

  console.log(
    "Setup stages found:",
    setupStage?.map((s: any) => `${s.id} (${s.name})`)
  );

  const territoryAssignments = [
    { territory: "ALCHUA", journeyId: "30ba5425-7c24-4787-9fcd-e1ed673d5a52", name: "Jonathan Dreyer" },
    { territory: "MONMTH", journeyId: "8be61a45-3927-48b9-8ff3-f990a8c79c5f", name: "William Scott" },
    { territory: "NOWTNJ", journeyId: "adfe39bc-6799-499c-bb37-381d4682cd44", name: "Ryan Rodriguez-Wiggins" },
    { territory: "WICHTA", journeyId: "622cb941-8d86-4856-b9c7-cff4ee8756ec", name: "Jonathan Suda" },
  ];

  for (const a of territoryAssignments) {
    // Find the JPS row with null territory and active Setup stage
    const { data: jps } = await sb
      .from("journey_pipeline_state")
      .select("id, TerritorySlug, current_stage_id, is_active, pipeline_stages(name)")
      .eq("journey_id", a.journeyId)
      .is("TerritorySlug", null)
      .eq("is_active", true);

    const setupJps = (jps as any[])?.find((j: any) => j.pipeline_stages?.name === "Setup");
    if (setupJps) {
      log(`${a.territory} → ${a.name}: Updating JPS ${setupJps.id} (Setup) from null → ${a.territory}`);
      if (!DRY_RUN) {
        const { error } = await sb
          .from("journey_pipeline_state")
          .update({ TerritorySlug: a.territory })
          .eq("id", setupJps.id);
        if (error) log(`  ERROR: ${error.message}`);
      }
    } else {
      log(`${a.territory} → ${a.name}: No null-territory Setup JPS found`);
      // Log what we did find
      if (jps?.length) {
        for (const j of jps as any[]) {
          log(`  Found: JPS ${j.id} stage=${j.pipeline_stages?.name} active=${j.is_active}`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. CREATE TERRITORY_OWNERS RECORDS
  // ═══════════════════════════════════════════════════════════════
  console.log("\n=== 3. CREATE TERRITORY_OWNERS RECORDS ===\n");

  const today = new Date().toISOString().split("T")[0];
  const newOwners = [
    { slug: "ALCHUA", ghlId: "BsfxQrK7jlE6z8IVBn1E", name: "Jonathan Dreyer" },
    { slug: "MONMTH", ghlId: "vabGOf97lBIzIk24iE9n", name: "William Scott" },
    { slug: "NOWTNJ", ghlId: "QVgNNQi2gBwcALnvsoAU", name: "Ryan Rodriguez-Wiggins" },
    { slug: "SASOTA", ghlId: "g56PXIJ4RCCDVCeDznQx", name: "Erik Spersrud" },
    { slug: "WICHTA", ghlId: "BMkZ2m9s5K1r9UNcHABl", name: "Jonathan Suda" },
  ];

  for (const o of newOwners) {
    // Check if owner already exists
    const { data: existing } = await sb
      .from("territory_owners")
      .select("id")
      .eq("TerritorySlug", o.slug)
      .is("end_date", null);

    if (existing?.length) {
      log(`${o.slug}: owner already exists, skipping`);
      continue;
    }

    log(`${o.slug}: Creating owner record for ${o.name} (${o.ghlId})`);
    if (!DRY_RUN) {
      const { error } = await sb.from("territory_owners").insert({
        TerritorySlug: o.slug,
        ghl_contact_id: o.ghlId,
        role: "owner",
        start_date: today,
      });
      if (error) log(`  ERROR: ${error.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. ADD SASOTA TO ERIK SPERSRUD'S JOURNEY
  // ═══════════════════════════════════════════════════════════════
  console.log("\n=== 4. ADD SASOTA TO ERIK SPERSRUD'S JOURNEY ===\n");

  const erikJourneyId = "82ebffcd-badf-4e54-a78a-c03fb88a4593";

  // Check if SASOTA JPS already exists
  const { data: sasotaJps } = await sb
    .from("journey_pipeline_state")
    .select("id, TerritorySlug, is_active, pipeline_stages(name)")
    .eq("journey_id", erikJourneyId)
    .eq("TerritorySlug", "SASOTA");

  if (sasotaJps?.length) {
    log("SASOTA JPS already exists for Erik's journey");
  } else {
    // Get the onboarding pipeline + Setup stage
    const { data: pipelines } = await sb.from("pipelines").select("id, name").eq("name", "Onboarding");

    const onboardingPipeline = pipelines?.[0];
    if (!onboardingPipeline) {
      // Try sales pipeline
      const { data: salesPipelines } = await sb.from("pipelines").select("id, name");
      console.log(
        "Available pipelines:",
        salesPipelines?.map((p: any) => `${p.id}: ${p.name}`)
      );
    } else {
      const { data: stages } = await sb
        .from("pipeline_stages")
        .select("id, name, sort_order")
        .eq("pipeline_id", onboardingPipeline.id)
        .order("sort_order");

      const setupStage = stages?.find((s: any) => s.name === "Setup");
      if (setupStage) {
        log(`Adding SASOTA JPS to Erik's journey (pipeline=${onboardingPipeline.name}, stage=Setup)`);
        if (!DRY_RUN) {
          const { error } = await sb.from("journey_pipeline_state").insert({
            journey_id: erikJourneyId,
            TerritorySlug: "SASOTA",
            pipeline_id: onboardingPipeline.id,
            current_stage_id: setupStage.id,
            is_active: true,
            entered_pipeline_at: new Date().toISOString(),
            entered_current_stage_at: new Date().toISOString(),
          });
          if (error) log(`  ERROR: ${error.message}`);
        }
      } else {
        log("Could not find Setup stage in Onboarding pipeline");
        console.log(
          "Available stages:",
          stages?.map((s: any) => `${s.name} (${s.id})`)
        );
      }
    }
  }

  console.log("\n=== DONE ===");
  if (DRY_RUN) console.log("Run again without --dry-run to apply changes.");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
