/**
 * Backfill integration_logs rows for post-call agent runs that completed
 * before the agent started writing its own logs.
 *
 * Counts every call with ai_summary_generated_at set since the 1st of the
 * current month, then inserts one synthetic "post-call / success" log row
 * per call so the Settings > Agents "Runs MTD" counter reflects reality.
 *
 * Safe to run twice — checks for existing post-call logs and skips calls
 * already represented.
 *
 * Usage:
 *   npx tsx scripts/backfill-post-call-integration-logs.ts --dry-run
 *   npx tsx scripts/backfill-post-call-integration-logs.ts --live
 */

import "dotenv/config";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const DRY_RUN = !process.argv.includes("--live");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws as never },
});

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  console.log(`Month window: ${monthStart} → now\n`);

  // Pull processed calls this month
  const { data: calls, error } = await supabase
    .from("calls")
    .select("id, ai_summary_generated_at, contact_id")
    .gte("ai_summary_generated_at", monthStart)
    .order("ai_summary_generated_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch calls:", error.message);
    process.exit(1);
  }

  console.log(`Found ${calls.length} processed calls this month\n`);

  // Pull existing post-call logs this month so we don't double-insert
  const { data: existingLogs } = await supabase
    .from("integration_logs")
    .select("payload_summary")
    .eq("integration_name", "post-call")
    .gte("created_at", monthStart);

  const loggedCallIds = new Set<string>();
  for (const log of existingLogs ?? []) {
    const match = log.payload_summary?.match(/call ([a-f0-9-]+):/);
    if (match) loggedCallIds.add(match[1]);
  }
  console.log(`Existing post-call logs this month: ${existingLogs?.length ?? 0}\n`);

  let inserted = 0;
  let skipped = 0;

  for (const call of calls) {
    if (loggedCallIds.has(call.id)) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  Would insert log for call ${call.id} (${call.ai_summary_generated_at})`);
    } else {
      const { error: insertError } = await supabase.from("integration_logs").insert({
        integration_name: "post-call",
        event_type: "agent_run",
        status: "success",
        payload_summary: `call ${call.id}: backfilled`,
        created_at: call.ai_summary_generated_at,
      });

      if (insertError) {
        console.warn(`  Insert failed for ${call.id}: ${insertError.message}`);
        continue;
      }
    }
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted}, Already logged: ${skipped}`);
}

main();
