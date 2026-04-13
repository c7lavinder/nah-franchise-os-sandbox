/**
 * Post-Call Agent — orchestrates all 4 AI analysis sections after a call.
 *
 * Sections run in parallel. If any section fails, the others still write.
 * Each section has its own prompt file in ./prompts/ for independent tuning.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { CallContext, SummaryResult, CoachingResult, NextStepsResult, ExtractionResult } from "./types";
import { runSummary } from "./prompts/summary";
import { runCoaching } from "./prompts/coaching";
import { runNextSteps } from "./prompts/next-steps";
import { runExtraction } from "./prompts/extraction";

// ── Model routing ──────────────────────────────────────────
// Change model per section here. One line per section.
const MODELS = {
  summary: "claude-haiku-4-5-20251001",
  coaching: "claude-haiku-4-5-20251001",
  nextSteps: "claude-haiku-4-5-20251001",
  extraction: "claude-haiku-4-5-20251001",
};

// ── Public API ─────────────────────────────────────────────

export async function runPostCallAgent(callId: string): Promise<{
  success: boolean;
  summary: string | null;
  coaching: CoachingResult | null;
  actionsCount: number;
  extractionsCount: number;
  errors: string[];
}> {
  const supabase = createServerClient();

  // 1. Load context
  const context = await loadCallContext(callId, supabase);
  if (!context) {
    return { success: false, summary: null, coaching: null, actionsCount: 0, extractionsCount: 0, errors: ["Call not found"] };
  }
  if (!context.transcript) {
    return { success: false, summary: null, coaching: null, actionsCount: 0, extractionsCount: 0, errors: ["No transcript available"] };
  }

  // 2. Run all 4 sections in parallel
  const [summaryRes, coachingRes, actionsRes, extractionsRes] = await Promise.allSettled([
    runSummary(context, MODELS.summary),
    runCoaching(context, MODELS.coaching),
    runNextSteps(context, MODELS.nextSteps),
    runExtraction(context, MODELS.extraction),
  ]);

  const summary = summaryRes.status === "fulfilled" ? summaryRes.value : null;
  const coaching = coachingRes.status === "fulfilled" ? coachingRes.value : null;
  const actions = actionsRes.status === "fulfilled" ? actionsRes.value : null;
  const extractions = extractionsRes.status === "fulfilled" ? extractionsRes.value : null;

  // Collect errors for diagnostics
  const errors: string[] = [];
  if (summaryRes.status === "rejected") errors.push(`summary: ${String(summaryRes.reason)}`);
  if (coachingRes.status === "rejected") errors.push(`coaching: ${String(coachingRes.reason)}`);
  if (actionsRes.status === "rejected") errors.push(`actions: ${String(actionsRes.reason)}`);
  if (extractionsRes.status === "rejected") errors.push(`extractions: ${String(extractionsRes.reason)}`);

  // 3. Write results to DB
  await writeResults(callId, context.contactId, { summary, coaching, actions, extractions }, supabase);

  return {
    success: errors.length === 0,
    summary: summary?.summary ?? null,
    coaching,
    actionsCount: actions?.actions?.length ?? 0,
    extractionsCount: extractions?.extractions?.filter((e) => e.extracted_value !== null).length ?? 0,
    errors,
  };
}

// ── Context loader ─────────────────────────────────────────

async function loadCallContext(
  callId: string,
  supabase: ReturnType<typeof createServerClient>,
): Promise<CallContext | null> {
  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, call_type_id, raw_transcript, title, started_at, duration_seconds")
    .eq("id", callId)
    .single();

  if (!call) return null;

  // Prefer call_transcripts table, fall back to raw_transcript
  const { data: transcriptRow } = await supabase
    .from("call_transcripts")
    .select("full_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const transcript = transcriptRow?.full_text ?? call.raw_transcript ?? "";

  // Resolve call type
  let callType: string | null = null;
  let callTypeSlug: string | null = null;
  if (call.call_type_id) {
    const { data: ct } = await supabase
      .from("call_types")
      .select("name, slug")
      .eq("id", call.call_type_id)
      .single();
    if (ct) { callType = ct.name; callTypeSlug = ct.slug; }
  }

  // Resolve contact name
  let contactName: string | null = null;
  if (call.contact_id) {
    const { data: c } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", call.contact_id)
      .single();
    if (c) contactName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || null;
  }

  // Resolve team member names from call_participants
  const { data: teamRows } = await supabase
    .from("call_participants")
    .select("display_name")
    .eq("call_id", callId)
    .eq("role", "nah_team");

  const teamMembers = (teamRows ?? []).map((r) => r.display_name ?? "Unknown");

  return {
    callId,
    transcript,
    callType,
    callTypeSlug,
    contactName,
    contactId: call.contact_id,
    teamMembers,
    callDate: call.started_at,
    durationSeconds: call.duration_seconds,
  };
}

// ── DB writer ──────────────────────────────────────────────

interface AgentResults {
  summary: SummaryResult | null;
  coaching: CoachingResult | null;
  actions: NextStepsResult | null;
  extractions: ExtractionResult | null;
}

async function writeResults(
  callId: string,
  contactId: string | null,
  results: AgentResults,
  supabase: ReturnType<typeof createServerClient>,
): Promise<void> {
  const now = new Date().toISOString();

  // Summary + coaching → calls table
  const callUpdate: Record<string, unknown> = {};
  if (results.summary) {
    callUpdate.ai_summary = results.summary.summary;
    callUpdate.ai_summary_generated_at = now;
  }
  if (results.coaching) {
    callUpdate.coaching_score = results.coaching.score;
    callUpdate.coaching_data = results.coaching;
    callUpdate.coaching_generated_at = now;
  }
  if (Object.keys(callUpdate).length > 0) {
    await supabase.from("calls").update(callUpdate).eq("id", callId);
  }

  // Action items → call_action_items
  if (results.actions && results.actions.actions.length > 0) {
    await supabase
      .from("call_action_items")
      .delete()
      .eq("call_id", callId)
      .eq("source", "scout")
      .eq("status", "pending");

    const rows = results.actions.actions.map((a) => ({
      call_id: callId,
      contact_id: contactId ?? null,
      category: a.category,
      title: a.title,
      description: a.description ?? null,
      source: "scout",
      ghl_action: a.ghl_action ?? false,
      status: "pending",
    }));

    await supabase.from("call_action_items").insert(rows);
  }

  // Data extractions → call_data_extractions
  if (results.extractions && results.extractions.extractions.length > 0) {
    await supabase
      .from("call_data_extractions")
      .delete()
      .eq("call_id", callId)
      .eq("source", "scout")
      .eq("saved_to_profile", false)
      .eq("dismissed", false);

    const rows = results.extractions.extractions
      .filter((e) => e.extracted_value !== null)
      .map((e) => ({
        call_id: callId,
        contact_id: contactId ?? null,
        field_key: e.field_key,
        field_category: e.field_category,
        extracted_value: e.extracted_value,
        confidence: e.confidence,
        source: "scout",
      }));

    if (rows.length > 0) {
      await supabase.from("call_data_extractions").insert(rows);
    }
  }
}
