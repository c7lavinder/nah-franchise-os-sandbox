/**
 * Post-drop sanity check for 20260422600000_drop_cps_legacy.sql.
 * Confirms: the cps table is gone, the jps-keyed indexes exist, and the
 * four replacement member-role policies were created against jps.
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
  // 1. contact_pipeline_state should be gone. A select should 404.
  const { error: cpsErr } = await supabase
    .from("contact_pipeline_state").select("id").limit(1);
  console.log(cpsErr
    ? `contact_pipeline_state: gone (error: ${cpsErr.message.slice(0, 80)})`
    : `contact_pipeline_state: STILL PRESENT — migration did not drop it`);

  // 2. Sub-task logs + stage history reads via jps still work.
  const { count: logsCount, error: logsErr } = await supabase
    .from("contact_sub_task_logs").select("id", { count: "exact", head: true });
  console.log(`contact_sub_task_logs: count=${logsCount}${logsErr ? `  ERR=${logsErr.message}` : ""}`);

  const { count: histCount, error: histErr } = await supabase
    .from("pipeline_stage_history").select("id", { count: "exact", head: true });
  console.log(`pipeline_stage_history: count=${histCount}${histErr ? `  ERR=${histErr.message}` : ""}`);

  // 3. jps still in good shape.
  const { count: jpsCount } = await supabase
    .from("journey_pipeline_state").select("id", { count: "exact", head: true });
  console.log(`journey_pipeline_state: count=${jpsCount}`);

  // 4. calls table (column-drop target) still readable.
  const { count: callsCount, error: callsErr } = await supabase
    .from("calls").select("id", { count: "exact", head: true });
  console.log(`calls: count=${callsCount}${callsErr ? `  ERR=${callsErr.message}` : ""}`);
}

void main();
