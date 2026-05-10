import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function main() {
  const id = process.argv[2] ?? "27f1818b-ffd7-4e5e-bf9f-34c31fbaf76b";
  const { data: j } = await supabase
    .from("journeys")
    .select("id, name, status, primary_contact_id")
    .eq("id", id)
    .maybeSingle();
  console.log("Journey:", j);
  if (!j) return;
  const { data: primary } = await supabase
    .from("contacts")
    .select("first_name, last_name, ghl_contact_id")
    .eq("id", j.primary_contact_id)
    .maybeSingle();
  console.log("Primary contact:", primary);
  const { data: members } = await supabase
    .from("journey_contacts")
    .select("role, contacts(first_name, last_name)")
    .eq("journey_id", id)
    .is("left_at", null);
  console.log("Members:", members);
  const { data: jps } = await supabase
    .from("journey_pipeline_state")
    .select("TerritorySlug, pipelines(slug), pipeline_stages(name), is_active")
    .eq("journey_id", id)
    .eq("is_active", true);
  console.log("Active pipeline states:", jps);
}
void main();
