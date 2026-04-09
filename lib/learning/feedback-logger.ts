/**
 * Learning Feedback Logger
 *
 * Logs every suggestion outcome (accepted / edited / skipped)
 * to the suggestion_feedback table. This is the core learning signal
 * for improving Scout's suggestions over time.
 */

import { createServerClient } from "@/lib/supabase/server";

export type SuggestionType =
  | "profile_update"
  | "next_step"
  | "coaching_edit"
  | "rubric_edit";

export type SuggestionOutcome = "accepted" | "edited" | "skipped";

export interface FeedbackEntry {
  suggestionType: SuggestionType;
  callId?: string;
  contactId?: string;
  repId: string;
  originalValue: unknown;
  acceptedValue?: unknown;
  outcome: SuggestionOutcome;
}

/**
 * Log a single suggestion feedback entry.
 */
export async function logSuggestionFeedback(
  entry: FeedbackEntry
): Promise<string> {
  const supabase = createServerClient();

  // Compute edit delta if edited
  let editDelta: Record<string, unknown> | null = null;
  if (entry.outcome === "edited" && entry.acceptedValue !== undefined) {
    editDelta = {
      original: entry.originalValue,
      accepted: entry.acceptedValue,
    };
  }

  const { data, error } = await supabase
    .from("suggestion_feedback")
    .insert({
      suggestion_type: entry.suggestionType,
      call_id: entry.callId ?? null,
      contact_id: entry.contactId ?? null,
      rep_id: entry.repId,
      original_value: entry.originalValue !== undefined
        ? JSON.stringify(entry.originalValue)
        : null,
      accepted_value: entry.acceptedValue !== undefined
        ? JSON.stringify(entry.acceptedValue)
        : null,
      outcome: entry.outcome,
      edit_delta: editDelta,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to log feedback: ${error.message}`);
  }

  return data.id;
}

/**
 * Log multiple feedback entries at once (e.g., when rep submits all cards).
 */
export async function logBatchFeedback(
  entries: FeedbackEntry[]
): Promise<{ logged: number; errors: string[] }> {
  const results = { logged: 0, errors: [] as string[] };

  for (const entry of entries) {
    try {
      await logSuggestionFeedback(entry);
      results.logged++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(msg);
    }
  }

  return results;
}

/**
 * Get feedback stats for a period (used in weekly reports).
 */
export async function getFeedbackStats(params: {
  startDate: string;
  endDate: string;
  repId?: string;
}): Promise<{
  total: number;
  accepted: number;
  edited: number;
  skipped: number;
  acceptRate: number;
  byType: Record<string, { accepted: number; edited: number; skipped: number }>;
}> {
  const supabase = createServerClient();

  let query = supabase
    .from("suggestion_feedback")
    .select("suggestion_type, outcome")
    .gte("created_at", `${params.startDate}T00:00:00Z`)
    .lte("created_at", `${params.endDate}T23:59:59Z`);

  if (params.repId) {
    query = query.eq("rep_id", params.repId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to get feedback stats: ${error.message}`);

  const rows = data ?? [];
  const stats = {
    total: rows.length,
    accepted: 0,
    edited: 0,
    skipped: 0,
    acceptRate: 0,
    byType: {} as Record<string, { accepted: number; edited: number; skipped: number }>,
  };

  for (const row of rows) {
    if (row.outcome === "accepted") stats.accepted++;
    else if (row.outcome === "edited") stats.edited++;
    else if (row.outcome === "skipped") stats.skipped++;

    if (!stats.byType[row.suggestion_type]) {
      stats.byType[row.suggestion_type] = { accepted: 0, edited: 0, skipped: 0 };
    }
    stats.byType[row.suggestion_type][row.outcome as SuggestionOutcome]++;
  }

  stats.acceptRate =
    stats.total > 0 ? (stats.accepted + stats.edited) / stats.total : 0;

  return stats;
}
