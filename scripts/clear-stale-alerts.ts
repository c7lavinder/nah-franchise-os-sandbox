/**
 * Sprint 0 fix: clear stale alerts from old accountability engine
 *
 * Per MASTER_PLAN.md §1.17, the bell will show only @-mention notifications
 * in Sprint 5. For now, mark all existing inactivity_alerts as resolved
 * so the bell shows 0.
 *
 * Usage: npx tsx scripts/clear-stale-alerts.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Count unresolved alerts first
  const { count: unresolvedCount, error: countError } = await supabase
    .from("inactivity_alerts")
    .select("id", { count: "exact", head: true })
    .eq("is_resolved", false);

  if (countError) {
    console.error("Failed to count unresolved alerts:", countError.message);
    process.exit(1);
  }

  console.log(`Found ${unresolvedCount ?? 0} unresolved alerts`);

  if (unresolvedCount === 0) {
    console.log("Nothing to clear — bell should already show 0");
    return;
  }

  // Mark all unresolved alerts as resolved
  const { error: updateError } = await supabase
    .from("inactivity_alerts")
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq("is_resolved", false);

  if (updateError) {
    console.error("Failed to resolve alerts:", updateError.message);
    process.exit(1);
  }

  // Verify
  const { count: remaining } = await supabase
    .from("inactivity_alerts")
    .select("id", { count: "exact", head: true })
    .eq("is_resolved", false);

  console.log(`✅ Cleared ${unresolvedCount} stale alerts`);
  console.log(`Remaining unresolved: ${remaining ?? 0}`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
