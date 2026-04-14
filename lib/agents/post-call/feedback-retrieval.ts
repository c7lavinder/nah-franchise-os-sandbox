/**
 * Feedback Retrieval — RAG for the post-call agent.
 *
 * Queries call_action_feedback joined with call_action_items to build
 * a learning context string the LLM can use to generate better actions.
 *
 * Retrieves patterns from:
 * 1. Same call type — "for intro calls, team always pushes pipeline log-off"
 * 2. Same contact — "last call with Jacob, team skipped the generic SMS"
 * 3. Global patterns — aggregate push/skip/edit rates by category
 */

import { createServerClient } from "@/lib/supabase/server";

interface FeedbackRow {
  action: string;
  payload: Record<string, unknown> | null;
  edit_diff: string | null;
  category: string;
  title: string;
  source: string;
  call_type_slug: string | null;
  contact_id: string | null;
}

export interface FeedbackContext {
  /** Human-readable summary for the LLM prompt */
  promptBlock: string;
  /** Raw stats for debugging */
  stats: {
    totalFeedback: number;
    callTypeMatches: number;
    contactMatches: number;
  };
}

/**
 * Retrieve feedback patterns relevant to the current call context.
 * Returns a prompt-ready block the LLM can consume.
 */
export async function retrieveFeedback(opts: {
  callTypeSlug: string | null;
  contactId: string | null;
}): Promise<FeedbackContext> {
  const supabase = createServerClient();

  // Fetch recent feedback joined with action items and calls
  // Limit to last 200 feedback entries for performance
  const { data: rows } = await supabase
    .from("call_action_feedback")
    .select(`
      action,
      payload,
      edit_diff,
      call_action_items!inner (
        category,
        title,
        source,
        calls!inner ( call_type_id, contact_id )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!rows || rows.length === 0) {
    return {
      promptBlock: "### Team Feedback History:\nNo prior feedback yet — this is the first generation.",
      stats: { totalFeedback: 0, callTypeMatches: 0, contactMatches: 0 },
    };
  }

  // Resolve call_type_ids to slugs for matching
  const callTypeIds = new Set<string>();
  for (const r of rows) {
    const items = Array.isArray(r.call_action_items) ? r.call_action_items : [r.call_action_items];
    for (const item of items) {
      const calls = Array.isArray(item.calls) ? item.calls : [item.calls];
      for (const call of calls) {
        if (call?.call_type_id) callTypeIds.add(call.call_type_id);
      }
    }
  }

  const callTypeMap = new Map<string, string>();
  if (callTypeIds.size > 0) {
    const { data: types } = await supabase
      .from("call_types")
      .select("id, slug")
      .in("id", [...callTypeIds]);
    for (const t of types ?? []) {
      callTypeMap.set(t.id, t.slug);
    }
  }

  // Flatten into analyzable rows
  const flat: FeedbackRow[] = [];
  for (const r of rows) {
    const items = Array.isArray(r.call_action_items) ? r.call_action_items : [r.call_action_items];
    for (const item of items) {
      const calls = Array.isArray(item.calls) ? item.calls : [item.calls];
      for (const call of calls) {
        flat.push({
          action: r.action,
          payload: r.payload as Record<string, unknown> | null,
          edit_diff: r.edit_diff,
          category: item.category,
          title: item.title,
          source: item.source,
          call_type_slug: call?.call_type_id ? (callTypeMap.get(call.call_type_id) ?? null) : null,
          contact_id: call?.contact_id ?? null,
        });
      }
    }
  }

  // Separate by relevance
  const callTypeMatches = opts.callTypeSlug
    ? flat.filter((r) => r.call_type_slug === opts.callTypeSlug)
    : [];
  const contactMatches = opts.contactId
    ? flat.filter((r) => r.contact_id === opts.contactId)
    : [];

  // Build aggregate stats
  const categoryStats = new Map<string, { pushed: number; skipped: number; edited: number }>();
  for (const r of flat) {
    const s = categoryStats.get(r.category) ?? { pushed: 0, skipped: 0, edited: 0 };
    if (r.action === "push") s.pushed++;
    else if (r.action === "skip") s.skipped++;
    else if (r.action === "edit") s.edited++;
    categoryStats.set(r.category, s);
  }

  // Build the prompt block
  const lines: string[] = ["### Team Feedback History (learn from this):"];

  // Global category stats
  lines.push("\n**Overall action acceptance rates:**");
  for (const [cat, s] of categoryStats.entries()) {
    const total = s.pushed + s.skipped + s.edited;
    if (total === 0) continue;
    const pushRate = Math.round(((s.pushed + s.edited) / total) * 100);
    const skipRate = Math.round((s.skipped / total) * 100);
    lines.push(`- ${cat}: ${pushRate}% accepted (${s.edited > 0 ? `${s.edited} edited first` : "no edits"}), ${skipRate}% skipped (${total} total)`);
  }

  // Call-type-specific patterns
  if (callTypeMatches.length > 0) {
    lines.push(`\n**For "${opts.callTypeSlug}" calls specifically (${callTypeMatches.length} prior actions):**`);
    const skipped = callTypeMatches.filter((r) => r.action === "skip");
    const pushed = callTypeMatches.filter((r) => r.action === "push" || r.action === "edit");
    if (skipped.length > 0) {
      const skipTitles = [...new Set(skipped.map((r) => r.title))].slice(0, 5);
      lines.push(`- Often SKIPPED: ${skipTitles.join(", ")}`);
    }
    if (pushed.length > 0) {
      const pushTitles = [...new Set(pushed.map((r) => r.title))].slice(0, 5);
      lines.push(`- Often PUSHED: ${pushTitles.join(", ")}`);
    }
  }

  // Contact-specific patterns
  if (contactMatches.length > 0) {
    lines.push(`\n**For this specific contact (${contactMatches.length} prior actions):**`);
    const edited = contactMatches.filter((r) => r.action === "edit");
    if (edited.length > 0) {
      for (const e of edited.slice(0, 3)) {
        const payload = e.payload;
        if (payload?.original_title && payload?.pushed_fields) {
          lines.push(`- Edited "${payload.original_title}" before pushing — fields changed: ${Object.keys(payload.pushed_fields as Record<string, unknown>).join(", ")}`);
        }
      }
    }
    const skipped = contactMatches.filter((r) => r.action === "skip");
    if (skipped.length > 0) {
      const skipCats = [...new Set(skipped.map((r) => r.category))];
      lines.push(`- Skipped categories: ${skipCats.join(", ")}`);
    }
  }

  // Specific edit patterns — what fields get changed most
  const editedRows = flat.filter((r) => r.action === "edit" && r.payload);
  if (editedRows.length >= 3) {
    const fieldChangeCounts = new Map<string, number>();
    for (const r of editedRows) {
      const pushed = r.payload?.pushed_fields as Record<string, unknown> | undefined;
      if (pushed) {
        for (const key of Object.keys(pushed)) {
          fieldChangeCounts.set(key, (fieldChangeCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const topFields = [...fieldChangeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (topFields.length > 0) {
      lines.push("\n**Most frequently edited fields (pay extra attention to these):**");
      for (const [field, count] of topFields) {
        lines.push(`- ${field}: edited ${count} times`);
      }
    }
  }

  if (flat.length < 5) {
    lines.push("\n*Limited feedback data — patterns will improve with more usage.*");
  }

  return {
    promptBlock: lines.join("\n"),
    stats: {
      totalFeedback: flat.length,
      callTypeMatches: callTypeMatches.length,
      contactMatches: contactMatches.length,
    },
  };
}
