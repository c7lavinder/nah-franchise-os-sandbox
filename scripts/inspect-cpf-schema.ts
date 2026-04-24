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
  const { data, error } = await sb.from("contact_profile_fields").select("*").limit(1);
  if (error) { console.error("ERR:", error.message); return; }
  if (data && data.length > 0) {
    console.log("columns:", Object.keys(data[0]));
  } else {
    console.log("table empty — try inserts");
  }

  // Attempt each possible column name to see which exist
  for (const col of ["field_name", "field_slug", "field_key"]) {
    const res = await sb.from("contact_profile_fields").select(`id,${col}`).limit(1);
    console.log(`  column ${col}:`, res.error?.message ?? "OK");
  }
  for (const col of ["source", "last_updated_by"]) {
    const res = await sb.from("contact_profile_fields").select(`id,${col}`).limit(1);
    console.log(`  column ${col}:`, res.error?.message ?? "OK");
  }
  for (const col of ["updated_at", "last_updated_at"]) {
    const res = await sb.from("contact_profile_fields").select(`id,${col}`).limit(1);
    console.log(`  column ${col}:`, res.error?.message ?? "OK");
  }
}

main().catch(console.error);
