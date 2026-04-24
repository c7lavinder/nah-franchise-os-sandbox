/**
 * One-off: Tyler's primary_motivation push was marked saved_to_profile=true
 * but silently failed because the save route used wrong column names. This
 * backfill writes the stored extraction value to contact_profile_fields using
 * the correct schema (field_name, jsonb, last_updated_by='ai').
 *
 * Idempotent — safe to re-run.
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

async function main() {
  // Find every extraction that claims saved_to_profile=true but has no
  // corresponding contact_profile_fields row — those are the silent failures
  // from before the column-name fix.
  const { data: extractions } = await sb
    .from("call_data_extractions")
    .select("id, contact_id, field_key, extracted_value")
    .eq("saved_to_profile", true)
    .not("contact_id", "is", null)
    .not("extracted_value", "is", null);

  if (!extractions || extractions.length === 0) {
    console.log("No saved extractions to check.");
    return;
  }

  console.log(`Checking ${extractions.length} saved extractions...`);
  let backfilled = 0;
  let alreadyPresent = 0;

  for (const e of extractions) {
    if (!e.contact_id || !e.extracted_value) continue;

    const { data: existing } = await sb
      .from("contact_profile_fields")
      .select("id")
      .eq("contact_id", e.contact_id)
      .eq("field_name", e.field_key)
      .maybeSingle();

    if (existing) {
      alreadyPresent++;
      continue;
    }

    const { error } = await sb
      .from("contact_profile_fields")
      .upsert(
        {
          contact_id: e.contact_id,
          field_name: e.field_key,
          field_value: JSON.stringify(e.extracted_value),
          last_updated_by: "ai",
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: "contact_id,field_name" }
      );
    if (error) {
      console.log(`  ERR on ${e.field_key} for ${e.contact_id.slice(0, 8)}: ${error.message}`);
    } else {
      backfilled++;
      console.log(`  ok: ${e.field_key} = ${e.extracted_value.slice(0, 40)}`);
    }
  }

  console.log(`\nBackfilled: ${backfilled}. Already present: ${alreadyPresent}.`);
}

main().catch(console.error);
