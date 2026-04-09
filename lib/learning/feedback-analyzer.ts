/**
 * Learning Feedback Analyzer
 *
 * Analyzes suggestion_feedback data to power weekly reports
 * and rubric refinement suggestions.
 */

import { createServerClient } from "@/lib/supabase/server";

/**
 * Get suggestion acceptance rate for a rep over N days.
 */
export async function getRepAcceptanceRate(
  repId: string,
  days: number = 30
): Promise<{ total: number; accepted: number; edited: number; skipped: number; rate: number }> {
  const supabase = createServerClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("suggestion_feedback")
    .select("outcome")
    .eq("rep_id", repId)
    .gte("created_at", since);

  const rows = data ?? [];
  const accepted = rows.filter((r) => r.outcome === "accepted").length;
  const edited = rows.filter((r) => r.outcome === "edited").length;
  const skipped = rows.filter((r) => r.outcome === "skipped").length;
  const total = rows.length;

  return {
    total,
    accepted,
    edited,
    skipped,
    rate: total > 0 ? (accepted + edited) / total : 0,
  };
}

/**
 * Get acceptance rate per suggestion type.
 */
export async function getActionTypeAcceptanceRate(
  days: number = 30
): Promise<Record<string, { total: number; accepted: number; edited: number; skipped: number; rate: number }>> {
  const supabase = createServerClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("suggestion_feedback")
    .select("suggestion_type, outcome")
    .gte("created_at", since);

  const byType: Record<string, { total: number; accepted: number; edited: number; skipped: number; rate: number }> = {};

  for (const row of data ?? []) {
    if (!byType[row.suggestion_type]) {
      byType[row.suggestion_type] = { total: 0, accepted: 0, edited: 0, skipped: 0, rate: 0 };
    }
    byType[row.suggestion_type].total++;
    if (row.outcome === "accepted") byType[row.suggestion_type].accepted++;
    else if (row.outcome === "edited") byType[row.suggestion_type].edited++;
    else if (row.outcome === "skipped") byType[row.suggestion_type].skipped++;
  }

  for (const t of Object.values(byType)) {
    t.rate = t.total > 0 ? (t.accepted + t.edited) / t.total : 0;
  }

  return byType;
}

/**
 * Get the most frequently edited profile fields.
 */
export async function getMostEditedFields(
  days: number = 30
): Promise<Array<{ fieldName: string; editCount: number }>> {
  const supabase = createServerClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("suggestion_feedback")
    .select("original_value, accepted_value, edit_delta")
    .eq("suggestion_type", "profile_update")
    .eq("outcome", "edited")
    .gte("created_at", since);

  const fieldCounts: Record<string, number> = {};
  for (const row of data ?? []) {
    const delta = row.edit_delta as { original?: { field_name?: string } } | null;
    const fieldName = delta?.original?.field_name ?? "unknown";
    fieldCounts[fieldName] = (fieldCounts[fieldName] ?? 0) + 1;
  }

  return Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([fieldName, editCount]) => ({ fieldName, editCount }));
}

/**
 * Get rejection patterns — what types of suggestions get rejected most.
 */
export async function getRejectionPatterns(
  days: number = 30
): Promise<Array<{ type: string; count: number; pct: number }>> {
  const supabase = createServerClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("suggestion_feedback")
    .select("suggestion_type, outcome")
    .eq("outcome", "skipped")
    .gte("created_at", since);

  const { data: allData } = await supabase
    .from("suggestion_feedback")
    .select("suggestion_type")
    .gte("created_at", since);

  const rejectedByType: Record<string, number> = {};
  const totalByType: Record<string, number> = {};

  for (const row of data ?? []) {
    rejectedByType[row.suggestion_type] = (rejectedByType[row.suggestion_type] ?? 0) + 1;
  }
  for (const row of allData ?? []) {
    totalByType[row.suggestion_type] = (totalByType[row.suggestion_type] ?? 0) + 1;
  }

  return Object.entries(rejectedByType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      count,
      pct: totalByType[type] ? count / totalByType[type] : 0,
    }));
}
