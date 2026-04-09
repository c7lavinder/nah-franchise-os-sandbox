/**
 * Scout Learning System
 *
 * Reads/writes suggestion_feedback (the existing learning table).
 * Push actions write to contact_profile_fields (EAV with field_name column).
 * Handles duplicate field suggestions via supersede/combine.
 */

import { createServerClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────
// Write suggestion outcome — fires on every push/edit/skip
// ─────────────────────────────────────────────────────────

export async function writeSuggestionOutcome(data: {
  suggestion_id: string;
  call_id?: string;
  call_type?: string;
  contact_id?: string;
  territory_ms_slug?: string;
  pipeline_stage?: string;
  field_name: string;
  suggested_value: string;
  confidence?: string;
  outcome: "pushed" | "edited_pushed" | "skipped";
  final_value?: string;
  reviewer_id: string;
}): Promise<void> {
  const supabase = createServerClient();

  const editDiff =
    data.outcome === "edited_pushed" && data.final_value
      ? { from: data.suggested_value, to: data.final_value }
      : null;

  await supabase.from("suggestion_feedback").insert({
    suggestion_type: "data_update",
    call_id: data.call_id ?? null,
    contact_id: data.contact_id ?? null,
    rep_id: data.reviewer_id,
    original_value: data.suggested_value,
    accepted_value: data.final_value ?? data.suggested_value,
    outcome: data.outcome === "edited_pushed" ? "edited" : data.outcome === "pushed" ? "accepted" : "skipped",
    edit_delta: editDiff,
    call_type: data.call_type ?? null,
    pipeline_stage: data.pipeline_stage ?? null,
    territory_ms_slug: data.territory_ms_slug ?? null,
    field_name: data.field_name,
    suggested_value: data.suggested_value,
    final_value: data.final_value ?? null,
    confidence: data.confidence ?? null,
    suggestion_id: data.suggestion_id,
    reviewer_id: data.reviewer_id,
    resolved_at: new Date().toISOString(),
  });

  await supabase
    .from("data_update_suggestions")
    .update({
      status: data.outcome,
      final_value: data.final_value ?? null,
      reviewer_id: data.reviewer_id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.suggestion_id);
}

// ─────────────────────────────────────────────────────────
// Get learning context — fires BEFORE Scout generates suggestions
// ─────────────────────────────────────────────────────────

export async function getSuggestionContext(callType: string): Promise<string> {
  const supabase = createServerClient();

  const { data: outcomes } = await supabase
    .from("suggestion_feedback")
    .select("field_name, outcome, suggested_value, final_value, edit_delta")
    .eq("call_type", callType)
    .not("outcome", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!outcomes || outcomes.length === 0) return "";

  const stats: Record<
    string,
    { pushed: number; edited: number; skipped: number; total: number; editExamples: string[] }
  > = {};

  for (const row of outcomes) {
    const fname = row.field_name ?? "unknown";
    if (!stats[fname]) {
      stats[fname] = { pushed: 0, edited: 0, skipped: 0, total: 0, editExamples: [] };
    }
    const s = stats[fname];
    s.total++;
    if (row.outcome === "accepted") s.pushed++;
    else if (row.outcome === "edited") {
      s.edited++;
      if (row.edit_delta && s.editExamples.length < 3) {
        const d = row.edit_delta as { from: string; to: string };
        if (d.from && d.to) s.editExamples.push(`"${d.from}" → "${d.to}"`);
      }
    } else s.skipped++;
  }

  const lines = ["SUGGESTION LEARNING CONTEXT:"];
  for (const [field, s] of Object.entries(stats)) {
    if (s.total < 3) continue;
    const pushRate = s.pushed / s.total;
    const skipRate = s.skipped / s.total;
    const editRate = s.edited / s.total;
    if (skipRate >= 0.7)
      lines.push(`- ${field}: skipped ${Math.round(skipRate * 100)}% — only suggest if explicit.`);
    else if (pushRate >= 0.85 && editRate <= 0.1)
      lines.push(`- ${field}: ${Math.round(pushRate * 100)}% pushed — suggest confidently.`);
    else if (editRate >= 0.3 && s.editExamples.length > 0)
      lines.push(
        `- ${field}: ${Math.round(editRate * 100)}% edited. Corrections: ${s.editExamples.slice(0, 2).join(" | ")}`
      );
  }

  return lines.length > 1 ? lines.join("\n") : "";
}

// ─────────────────────────────────────────────────────────
// Badge count for profile tabs
// ─────────────────────────────────────────────────────────

export async function getPendingSuggestionCount(
  contactId?: string,
  territorySlug?: string
): Promise<number> {
  const supabase = createServerClient();

  let query = supabase
    .from("data_update_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (contactId) query = query.eq("contact_id", contactId);
  else if (territorySlug) query = query.eq("territory_ms_slug", territorySlug);
  else return 0;

  const { count } = await query;
  return count ?? 0;
}

// ─────────────────────────────────────────────────────────
// Push a suggestion — writes to correct table
// ─────────────────────────────────────────────────────────

export async function pushSuggestion(
  suggestionId: string,
  finalValue: string,
  reviewerId: string
): Promise<void> {
  const supabase = createServerClient();

  const { data: sug } = await supabase
    .from("data_update_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .single();

  if (!sug) return;

  // Write to the correct table
  if (sug.field_table === "contact_profile_fields" && sug.contact_id) {
    // EAV upsert — uses field_name column (not field_key)
    await supabase.from("contact_profile_fields").upsert(
      {
        contact_id: sug.contact_id,
        field_name: sug.field_name,
        field_value: JSON.stringify(finalValue),
        last_updated_by: "ai",
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: "contact_id,field_name" }
    );
  } else if (sug.field_table === "territory_profile" && sug.territory_ms_slug) {
    await supabase
      .from("territory_profile")
      .update({
        [sug.field_name]: finalValue,
        updated_at: new Date().toISOString(),
      })
      .eq("ms_slug", sug.territory_ms_slug);
  }

  await writeSuggestionOutcome({
    suggestion_id: suggestionId,
    field_name: sug.field_name,
    suggested_value: sug.suggested_value,
    outcome: finalValue === sug.suggested_value ? "pushed" : "edited_pushed",
    final_value: finalValue,
    reviewer_id: reviewerId,
    contact_id: sug.contact_id,
    territory_ms_slug: sug.territory_ms_slug,
  });
}

// ─────────────────────────────────────────────────────────
// Handle duplicate field suggestions
// ─────────────────────────────────────────────────────────

export async function handleDuplicateFieldSuggestion(newSug: {
  contact_id?: string;
  territory_ms_slug?: string;
  field_name: string;
  field_table: string;
  suggested_value: string;
  source: string;
  source_id?: string;
  evidence?: string;
  confidence?: string;
}): Promise<string> {
  const supabase = createServerClient();

  const entityFilter = newSug.contact_id
    ? { contact_id: newSug.contact_id }
    : { territory_ms_slug: newSug.territory_ms_slug };

  const { data: existing } = await supabase
    .from("data_update_suggestions")
    .select("id, suggested_value, source, combined_sources")
    .match({ ...entityFilter, field_name: newSug.field_name, status: "pending" })
    .maybeSingle();

  if (!existing) {
    const { data } = await supabase
      .from("data_update_suggestions")
      .insert({ ...entityFilter, ...newSug })
      .select("id")
      .single();
    return data?.id ?? "";
  }

  // Same source type = combine. Different = override (supersede).
  if (existing.source === newSug.source) {
    await supabase
      .from("data_update_suggestions")
      .update({
        suggested_value: `${existing.suggested_value} · ${newSug.suggested_value}`,
        combined_sources: [
          ...(existing.combined_sources || []),
          newSug.source_id || newSug.source,
        ],
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return existing.id;
  } else {
    const { data: newRow } = await supabase
      .from("data_update_suggestions")
      .insert({ ...entityFilter, ...newSug })
      .select("id")
      .single();
    if (newRow) {
      await supabase
        .from("data_update_suggestions")
        .update({
          status: "superseded",
          superseded_by: newRow.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    return newRow?.id ?? "";
  }
}
