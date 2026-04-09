/**
 * System Log Aggregator
 *
 * Aggregates daily Scout action logs into a summary.
 * Called by the 11pm cron job.
 */

import { createServerClient } from "@/lib/supabase/server";

export async function runSystemLogCron(
  date?: string
): Promise<{ logged: number }> {
  const supabase = createServerClient();
  const logDate = date ?? new Date().toISOString().split("T")[0];
  const startOfDay = `${logDate}T00:00:00Z`;
  const endOfDay = `${logDate}T23:59:59Z`;

  // Fetch all Scout action logs from today
  const { data: actions, error } = await supabase
    .from("scout_action_logs")
    .select("id, action_type, action_status, user_id, ghl_contact_id, created_at")
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay);

  if (error) {
    throw new Error(`Failed to fetch action logs: ${error.message}`);
  }

  if (!actions || actions.length === 0) {
    return { logged: 0 };
  }

  // Aggregate by action type
  const byType: Record<string, { total: number; executed: number; rejected: number }> = {};
  for (const action of actions) {
    if (!byType[action.action_type]) {
      byType[action.action_type] = { total: 0, executed: 0, rejected: 0 };
    }
    byType[action.action_type].total++;
    if (action.action_status === "executed") {
      byType[action.action_type].executed++;
    } else if (action.action_status === "rejected") {
      byType[action.action_type].rejected++;
    }
  }

  // Write summary to system_logs
  const { error: insertError } = await supabase.from("system_logs").insert({
    log_date: logDate,
    action_type: "daily_summary",
    input_params: {
      total_actions: actions.length,
      by_type: byType,
      unique_contacts: new Set(actions.map((a) => a.ghl_contact_id).filter(Boolean)).size,
      unique_users: new Set(actions.map((a) => a.user_id)).size,
    },
    result_summary: `${actions.length} Scout actions logged across ${Object.keys(byType).length} action types`,
    was_auto: true,
  });

  if (insertError) {
    throw new Error(`Failed to write system log: ${insertError.message}`);
  }

  return { logged: actions.length };
}
