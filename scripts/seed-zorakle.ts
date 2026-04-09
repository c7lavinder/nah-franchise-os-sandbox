/**
 * Seed Zorakle Profiles from zorakle-master-final.json
 *
 * Computes fit_score + risk_flag for every record on insert.
 * Records with ms_slug = 'UNKNOWN' → stored as NULL FK (not rejected).
 * Idempotent — uses full_name + batch as dedup key.
 *
 * Usage: npx tsx scripts/seed-zorakle.ts
 */

import "dotenv/config";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { computeFitScore, computeRiskFlag } from "../lib/zorakle";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface ZorakleRecord {
  ms_slug: string;
  full_name: string;
  batch: string;
  eclipse_overall: number | null;
  values_score: number | null;
  stages_score: number | null;
  cultural_score: number | null;
  sales_score: number | null;
  biz_path_score: number | null;
  values_type: string | null;
  culture: string | null;
  work_style: string | null;
  eclipse_drive_id: string | null;
  spoton_drive_id: string | null;
}

async function main() {
  const jsonPath = "data/zorakle-master-final.json";
  if (!fs.existsSync(jsonPath)) {
    console.error("File not found:", jsonPath);
    process.exit(1);
  }

  const records: ZorakleRecord[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`=== Seed Zorakle Profiles (${records.length} records) ===\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const riskCounts: Record<string, number> = {};
  let nullSlugCount = 0;

  for (const rec of records) {
    // UNKNOWN → NULL
    const msSlug = rec.ms_slug === "UNKNOWN" ? null : rec.ms_slug;
    if (msSlug === null) nullSlugCount++;

    // Compute fit_score and risk_flag
    const fitScore = computeFitScore({
      eclipse_overall: rec.eclipse_overall,
      values_type: rec.values_type,
      work_style: rec.work_style,
    });

    const riskFlag = computeRiskFlag({
      eclipse_overall: rec.eclipse_overall,
      values_type: rec.values_type,
      work_style: rec.work_style,
    });

    riskCounts[riskFlag ?? "null"] = (riskCounts[riskFlag ?? "null"] ?? 0) + 1;

    // Check if already exists (by full_name + batch)
    const { data: existing } = await supabase
      .from("zorakle_profiles")
      .select("id")
      .eq("full_name", rec.full_name)
      .eq("batch", rec.batch ?? "")
      .limit(1)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("zorakle_profiles").insert({
      ms_slug: msSlug,
      full_name: rec.full_name,
      batch: rec.batch,
      eclipse_overall: rec.eclipse_overall,
      values_score: rec.values_score,
      stages_score: rec.stages_score,
      cultural_score: rec.cultural_score,
      sales_score: rec.sales_score,
      biz_path_score: rec.biz_path_score,
      values_type: rec.values_type,
      culture: rec.culture,
      work_style: rec.work_style,
      eclipse_drive_id: rec.eclipse_drive_id,
      spoton_drive_id: rec.spoton_drive_id,
      fit_score: fitScore,
      risk_flag: riskFlag,
    });

    if (error) {
      console.error(`  ${rec.full_name}: ${error.message}`);
      errors++;
    } else {
      inserted++;
    }
  }

  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`NULL ms_slug (UNKNOWN): ${nullSlugCount}`);
  console.log(`\nRisk flag distribution:`);
  for (const [flag, count] of Object.entries(riskCounts).sort()) {
    console.log(`  ${flag}: ${count}`);
  }
}

main().catch(console.error);
