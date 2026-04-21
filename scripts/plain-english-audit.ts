/**
 * One-shot audit: shows everything the user needs to eyeball before
 * running 20260422600000_drop_cps_legacy.sql.
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data: users } = await supabase.from("users").select("role");
  const roleCounts = new Map<string, number>();
  for (const u of users ?? []) roleCounts.set(u.role, (roleCounts.get(u.role) ?? 0) + 1);
  console.log("Users by role:");
  for (const [role, count] of roleCounts) console.log(`  ${role}: ${count}`);

  const { count: cpsTotal } = await supabase
    .from("contact_pipeline_state").select("id", { count: "exact", head: true });
  const { count: cpsActive } = await supabase
    .from("contact_pipeline_state").select("id", { count: "exact", head: true }).eq("is_active", true);
  console.log(`\ncontact_pipeline_state rows:  total=${cpsTotal}  active=${cpsActive}`);

  const { count: jpsTotal } = await supabase
    .from("journey_pipeline_state").select("id", { count: "exact", head: true });
  const { count: jpsActive } = await supabase
    .from("journey_pipeline_state").select("id", { count: "exact", head: true }).eq("is_active", true);
  console.log(`journey_pipeline_state rows:  total=${jpsTotal}  active=${jpsActive}`);

  const { count: logsTotal } = await supabase
    .from("contact_sub_task_logs").select("id", { count: "exact", head: true });
  const { count: logsMissing } = await supabase
    .from("contact_sub_task_logs").select("id", { count: "exact", head: true }).is("journey_pipeline_state_id", null);
  console.log(`\ncontact_sub_task_logs:  total=${logsTotal}  missing jps_id=${logsMissing}`);

  const { count: histTotal } = await supabase
    .from("pipeline_stage_history").select("id", { count: "exact", head: true });
  const { count: histMissing } = await supabase
    .from("pipeline_stage_history").select("id", { count: "exact", head: true }).is("journey_pipeline_state_id", null);
  console.log(`pipeline_stage_history: total=${histTotal}  missing jps_id=${histMissing}`);
}

void main();
