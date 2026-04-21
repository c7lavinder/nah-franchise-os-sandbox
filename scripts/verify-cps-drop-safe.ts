/**
 * Pre-flight check before 20260422600000_drop_cps_legacy.sql. Confirms:
 *   1. Every contact_sub_task_logs row has journey_pipeline_state_id set.
 *   2. Every pipeline_stage_history row has journey_pipeline_state_id set.
 *   3. No remaining app-code paths (checked manually via grep) write cps.
 * Fails loudly if any row would violate the NOT NULL constraint introduced
 * by the migration — better to know before the migration runs than halfway
 * through.
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
  const { count: logsMissing, error: e1 } = await supabase
    .from("contact_sub_task_logs")
    .select("id", { count: "exact", head: true })
    .is("journey_pipeline_state_id", null);
  if (e1) throw new Error(e1.message);
  console.log(`contact_sub_task_logs with NULL jps_id: ${logsMissing}`);

  const { count: historyMissing, error: e2 } = await supabase
    .from("pipeline_stage_history")
    .select("id", { count: "exact", head: true })
    .is("journey_pipeline_state_id", null);
  if (e2) throw new Error(e2.message);
  console.log(`pipeline_stage_history with NULL jps_id: ${historyMissing}`);

  if ((logsMissing ?? 0) > 0 || (historyMissing ?? 0) > 0) {
    console.error("\nABORT: backfill gap detected. Drop migration will fail.");
    process.exit(1);
  }
  console.log("\nSafe to run 20260422600000_drop_cps_legacy.sql");
}

void main();
