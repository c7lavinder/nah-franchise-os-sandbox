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
  const { data: calls } = await sb
    .from("calls")
    .select("id, title, contact_id, started_at")
    .ilike("title", "%Tyler%Schoettmer%")
    .order("started_at", { ascending: false })
    .limit(3);
  console.log("Tyler calls:", calls);

  if (!calls || calls.length === 0) return;
  const call = calls[0];

  const { data: extractions } = await sb
    .from("call_data_extractions")
    .select("field_key, field_category, extracted_value, confidence, saved_to_profile, dismissed")
    .eq("call_id", call.id);
  console.log(`\nExtractions (${extractions?.length ?? 0}):`);
  const byCat: Record<string, string[]> = {};
  for (const e of extractions ?? []) {
    byCat[e.field_category] = byCat[e.field_category] ?? [];
    byCat[e.field_category].push(`${e.field_key} = ${e.extracted_value} (${e.confidence}, saved=${e.saved_to_profile})`);
  }
  for (const [cat, items] of Object.entries(byCat)) {
    console.log(`\n  [${cat}]`);
    for (const i of items) console.log(`    ${i}`);
  }

  // Check profile fields for Tyler
  if (call.contact_id) {
    const { data: profileRows } = await sb
      .from("contact_profile_fields")
      .select("field_name, field_value, last_updated_by, last_updated_at")
      .eq("contact_id", call.contact_id)
      .order("last_updated_at", { ascending: false });
    console.log(`\nProfile rows for contact (${profileRows?.length ?? 0}):`);
    for (const r of profileRows ?? []) {
      console.log(`  ${r.field_name} = ${JSON.stringify(r.field_value)} [${r.last_updated_by}]`);
    }
  }
}

main().catch(console.error);
