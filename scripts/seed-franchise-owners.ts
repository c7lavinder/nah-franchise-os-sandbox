/**
 * Seed Franchise Owners from owner-master-index-full.csv
 *
 * Upserts territories first (FK dependency), then franchise_owners.
 * Creates empty territory_profile shells for all active territories.
 * Idempotent — safe to re-run.
 *
 * Usage: npx tsx scripts/seed-franchise-owners.ts
 */

import "dotenv/config";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface OwnerRow {
  ms_slug: string;
  full_name: string;
  status: string;
  ct_id: string;
  ct_email: string;
  eclipse_drive_id: string;
  eclipse_overall: string;
  eclipse_drive_url: string;
}

function parseCSV(content: string): OwnerRow[] {
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: OwnerRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row as unknown as OwnerRow);
  }
  return rows;
}

async function main() {
  const csvPath = "data/owner-master-index-full.csv";
  if (!fs.existsSync(csvPath)) {
    console.error("File not found:", csvPath);
    process.exit(1);
  }

  const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
  console.log(`=== Seed Franchise Owners (${rows.length} records) ===\n`);

  let territoriesUpserted = 0;
  let ownersUpserted = 0;
  let profilesCreated = 0;
  let errors = 0;

  for (const row of rows) {
    if (!row.ms_slug) continue;

    // 1. Upsert territory
    const { error: tErr } = await supabase
      .from("territories")
      .upsert(
        {
          ms_slug: row.ms_slug,
          territory_name: row.ms_slug, // Will be human-named later
          status: row.status || "active",
        },
        { onConflict: "ms_slug" }
      );

    if (tErr) {
      console.error(`  Territory ${row.ms_slug}: ${tErr.message}`);
      errors++;
      continue;
    }
    territoriesUpserted++;

    // 2. Upsert franchise_owner
    const { error: oErr } = await supabase
      .from("franchise_owners")
      .upsert(
        {
          ms_slug: row.ms_slug,
          full_name: row.full_name,
          status: row.status || "active",
          ct_id: row.ct_id || null,
          ct_email: row.ct_email || null,
        },
        { onConflict: "ms_slug" }
      );

    if (oErr) {
      console.error(`  Owner ${row.ms_slug}: ${oErr.message}`);
      errors++;
      continue;
    }
    ownersUpserted++;

    // 3. Create territory_profile shell if not exists
    const { error: pErr } = await supabase
      .from("territory_profile")
      .upsert(
        { ms_slug: row.ms_slug },
        { onConflict: "ms_slug" }
      );

    if (!pErr) profilesCreated++;
  }

  console.log(`Territories upserted: ${territoriesUpserted}`);
  console.log(`Owners upserted: ${ownersUpserted}`);
  console.log(`Profiles created: ${profilesCreated}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
