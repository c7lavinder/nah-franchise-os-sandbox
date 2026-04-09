/**
 * Weekly Scout Performance Report Generator
 *
 * Runs Sunday at 11pm. Aggregates suggestion_feedback, KB retrieval,
 * and gap signals into a weekly report stored in scout_performance_reports.
 */

import { createServerClient } from "@/lib/supabase/server";
import {
  getActionTypeAcceptanceRate,
  getMostEditedFields,
} from "./feedback-analyzer";
import { generateHealthReport } from "@/lib/kb/health-monitor";

export async function generateWeeklyReport(
  weekEnd?: string
): Promise<string> {
  const supabase = createServerClient();

  const endDate = weekEnd ?? new Date().toISOString().split("T")[0];
  const startDate = new Date(
    new Date(endDate).getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString().split("T")[0];

  const since = `${startDate}T00:00:00Z`;
  const until = `${endDate}T23:59:59Z`;

  // Get all feedback for the week
  const { data: feedback } = await supabase
    .from("suggestion_feedback")
    .select("suggestion_type, outcome, rep_id")
    .gte("created_at", since)
    .lte("created_at", until);

  const rows = feedback ?? [];
  const totalSuggestions = rows.length;
  const accepted = rows.filter((r) => r.outcome === "accepted").length;
  const edited = rows.filter((r) => r.outcome === "edited").length;
  const skipped = rows.filter((r) => r.outcome === "skipped").length;

  const acceptanceRate = totalSuggestions > 0 ? (accepted + edited) / totalSuggestions : 0;
  const editRate = totalSuggestions > 0 ? edited / totalSuggestions : 0;
  const rejectionRate = totalSuggestions > 0 ? skipped / totalSuggestions : 0;

  // Per-rep breakdown
  const repBreakdown: Record<string, { total: number; accepted: number; edited: number; skipped: number }> = {};
  for (const row of rows) {
    if (!repBreakdown[row.rep_id]) {
      repBreakdown[row.rep_id] = { total: 0, accepted: 0, edited: 0, skipped: 0 };
    }
    repBreakdown[row.rep_id].total++;
    if (row.outcome === "accepted") repBreakdown[row.rep_id].accepted++;
    else if (row.outcome === "edited") repBreakdown[row.rep_id].edited++;
    else if (row.outcome === "skipped") repBreakdown[row.rep_id].skipped++;
  }

  // Action type breakdown
  const actionTypeBreakdown = await getActionTypeAcceptanceRate(7);

  // Most edited fields
  const mostEditedFields = await getMostEditedFields(7);

  // Top rejected types
  const rejectedByType: Record<string, number> = {};
  for (const row of rows.filter((r) => r.outcome === "skipped")) {
    rejectedByType[row.suggestion_type] = (rejectedByType[row.suggestion_type] ?? 0) + 1;
  }
  const topRejected = Object.entries(rejectedByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  // KB health
  const kbHealth = await generateHealthReport();

  // Gap signals from this week
  const { data: weekGaps } = await supabase
    .from("kb_gap_signals")
    .select("query")
    .gte("searched_at", since)
    .lte("searched_at", until)
    .eq("resolved", false);

  // Store report
  const { data: report, error } = await supabase
    .from("scout_performance_reports")
    .upsert(
      {
        week_start: startDate,
        week_end: endDate,
        total_suggestions: totalSuggestions,
        acceptance_rate: acceptanceRate,
        edit_rate: editRate,
        rejection_rate: rejectionRate,
        top_rejected_types: topRejected,
        most_edited_fields: mostEditedFields.slice(0, 10),
        kb_retrieval_count: kbHealth.totalRetrievals,
        kb_gap_signals: (weekGaps ?? []).slice(0, 10),
        rep_breakdown: repBreakdown,
        action_type_breakdown: actionTypeBreakdown,
      },
      { onConflict: "week_start,week_end" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save weekly report: ${error.message}`);
  }

  return report.id;
}
