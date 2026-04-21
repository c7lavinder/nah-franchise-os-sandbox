/**
 * Post-Call Agent — orchestrates all 5 AI analysis sections after a call.
 *
 * Sections run in parallel. If any section fails, the others still write.
 * Each section has its own prompt file in ./prompts/ for independent tuning.
 *
 * Section 5 (KB Intelligence) extracts knowledge from every call and
 * auto-updates the knowledge base — questions, objections, competitive
 * intel, best practices, and process updates all flow into knowledge_documents.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { CallContext, SummaryResult, CoachingResult, NextStepsResult, ExtractionResult, PipelinePosition, RosterEntry } from "./types";
import { retrieveFeedback } from "./feedback-retrieval";
import { runSummary } from "./prompts/summary";
import { runCoaching } from "./prompts/coaching";
import { runNextSteps } from "./prompts/next-steps";
import { runExtraction } from "./prompts/extraction";
import { runKBIntelligence } from "./prompts/kb-intelligence";
import { updateKnowledgeBase } from "./kb-updater";

// ── Model routing ──────────────────────────────────────────
// Change model per section here. One line per section.
// All sections on Sonnet — every call is a high-value touchpoint,
// maximize intelligence extracted from each one.
const MODEL = "claude-4-sonnet-20250514";
const MODELS = {
  summary: MODEL,
  coaching: MODEL,
  nextSteps: MODEL,
  extraction: MODEL,
  kbIntelligence: MODEL,
};

// ── Public API ─────────────────────────────────────────────

export async function runPostCallAgent(callId: string): Promise<{
  success: boolean;
  summary: string | null;
  coaching: CoachingResult | null;
  actionsCount: number;
  extractionsCount: number;
  kbDocsUpdated: number;
  errors: string[];
}> {
  const supabase = createServerClient();

  // 1. Load context
  const context = await loadCallContext(callId, supabase);
  if (!context) {
    return { success: false, summary: null, coaching: null, actionsCount: 0, extractionsCount: 0, kbDocsUpdated: 0, errors: ["Call not found"] };
  }
  if (!context.transcript) {
    return { success: false, summary: null, coaching: null, actionsCount: 0, extractionsCount: 0, kbDocsUpdated: 0, errors: ["No transcript available"] };
  }

  // Idempotency guard: if summary already generated, check if extractions also exist.
  // If extractions are missing, run extraction only. If everything exists, skip entirely.
  const { data: callRow } = await supabase
    .from("calls")
    .select("ai_summary_generated_at")
    .eq("id", callId)
    .single();

  const { count: existingExtractions } = await supabase
    .from("call_data_extractions")
    .select("id", { count: "exact", head: true })
    .eq("call_id", callId);

  const alreadyHasSummary = !!callRow?.ai_summary_generated_at;
  const alreadyHasExtractions = (existingExtractions ?? 0) > 0;

  if (alreadyHasSummary && alreadyHasExtractions) {
    console.warn(`[post-call-agent] callId=${callId} already fully processed — skipping`);
    return { success: true, summary: "already_generated", coaching: null, actionsCount: 0, extractionsCount: 0, kbDocsUpdated: 0, errors: [] };
  }

  // 2. Run sections — if summary exists but extractions missing, only run extraction
  const extractionOnly = alreadyHasSummary && !alreadyHasExtractions;
  if (extractionOnly) {
    console.warn(`[post-call-agent] callId=${callId} summary exists but extractions missing — running extraction only`);
  }

  const [summaryRes, coachingRes, actionsRes, extractionsRes, kbRes] = await Promise.allSettled([
    extractionOnly ? Promise.resolve(null) : runSummary(context, MODELS.summary),
    extractionOnly ? Promise.resolve(null) : runCoaching(context, MODELS.coaching),
    extractionOnly ? Promise.resolve(null) : runNextSteps(context, MODELS.nextSteps),
    runExtraction(context, MODELS.extraction),
    extractionOnly ? Promise.resolve(null) : runKBIntelligence(context, MODELS.kbIntelligence),
  ]);

  const summary = summaryRes.status === "fulfilled" ? summaryRes.value : null;
  const coaching = coachingRes.status === "fulfilled" ? coachingRes.value : null;
  const actions = actionsRes.status === "fulfilled" ? actionsRes.value : null;
  const extractions = extractionsRes.status === "fulfilled" ? extractionsRes.value : null;
  const kbIntelligence = kbRes.status === "fulfilled" ? kbRes.value : null;

  // Collect errors for diagnostics — skip intentionally null sections (extraction-only mode)
  const errors: string[] = [];
  if (!extractionOnly) {
    if (summaryRes.status === "rejected") errors.push(`summary: ${String(summaryRes.reason)}`);
    else if (!summary) errors.push("summary: returned null (parse failure)");
    if (coachingRes.status === "rejected") errors.push(`coaching: ${String(coachingRes.reason)}`);
    else if (!coaching) errors.push("coaching: returned null (parse failure)");
    if (actionsRes.status === "rejected") errors.push(`actions: ${String(actionsRes.reason)}`);
    else if (!actions) errors.push("actions: returned null (parse failure)");
    if (kbRes.status === "rejected") errors.push(`kb-intelligence: ${String(kbRes.reason)}`);
    else if (!kbIntelligence) errors.push("kb-intelligence: returned null (parse failure)");
  }
  if (extractionsRes.status === "rejected") errors.push(`extractions: ${String(extractionsRes.reason)}`);
  else if (!extractions) errors.push("extractions: returned null (parse failure)");

  if (errors.length > 0) {
    console.error(`[post-call-agent] ${callId} errors:`, errors.join("; "));
  }

  // 3. Write results to DB
  await writeResults(callId, context.contactId, { summary, coaching, actions, extractions }, supabase);

  // 4. Update knowledge base with extracted intelligence
  let kbDocsUpdated = 0;
  if (kbIntelligence && kbIntelligence.items.length > 0) {
    try {
      const kbResult = await updateKnowledgeBase(
        kbIntelligence.items,
        callId,
        context.callDate,
        context.contactName,
        context.callType,
      );
      kbDocsUpdated = kbResult.docsUpdated;
    } catch (err) {
      errors.push(`kb-update: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    success: errors.length === 0,
    summary: summary?.summary ?? null,
    coaching,
    actionsCount: actions?.actions?.length ?? 0,
    extractionsCount: extractions?.extractions?.filter((e) => e.extracted_value !== null).length ?? 0,
    kbDocsUpdated,
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

  // Resolve ALL external contacts on this call (for multi-contact extraction)
  const { data: contactParticipants } = await supabase
    .from("call_participants")
    .select("display_name, contact_id")
    .eq("call_id", callId)
    .in("role", ["prospect", "franchisee"]);

  const contactNames: string[] = [];
  for (const cp of contactParticipants ?? []) {
    if (cp.contact_id) {
      const { data: c } = await supabase.from("contacts").select("first_name, last_name").eq("id", cp.contact_id).single();
      if (c) contactNames.push(`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || cp.display_name || "Unknown");
    } else if (cp.display_name) {
      contactNames.push(cp.display_name);
    }
  }
  // Ensure primary contact is included
  if (contactName && !contactNames.includes(contactName)) {
    contactNames.unshift(contactName);
  }

  // Resolve territories linked to contact(s)
  const territoryNames: string[] = [];
  const contactIds = (contactParticipants ?? []).map((p) => p.contact_id).filter(Boolean) as string[];
  if (call.contact_id && !contactIds.includes(call.contact_id)) contactIds.push(call.contact_id);
  if (contactIds.length > 0) {
    const { data: owners } = await supabase
      .from("territory_owners")
      .select("ms_slug, territories ( territory_name )")
      .in("ghl_contact_id",
        (await supabase.from("contacts").select("ghl_contact_id").in("id", contactIds)).data?.map((c) => c.ghl_contact_id).filter(Boolean) ?? []
      )
      .is("end_date", null);
    for (const o of owners ?? []) {
      const t = Array.isArray(o.territories) ? o.territories[0] : o.territories;
      const name = (t as { territory_name: string } | null)?.territory_name ?? o.ms_slug;
      if (!territoryNames.includes(name)) territoryNames.push(name);
    }
  }

  // Authoritative per-call territory list (set by the rep in the mapping modal).
  const callTerritories: CallContext["callTerritories"] = [];
  const { data: ctRows } = await supabase
    .from("call_territories")
    .select("territory_ms_slug, is_primary, territories ( territory_name )")
    .eq("call_id", callId)
    .order("is_primary", { ascending: false });
  for (const r of ctRows ?? []) {
    const t = Array.isArray(r.territories) ? r.territories[0] : r.territories;
    const name = (t as { territory_name: string } | null)?.territory_name ?? r.territory_ms_slug;
    callTerritories.push({
      ms_slug: r.territory_ms_slug,
      territory_name: name,
      is_primary: !!r.is_primary,
    });
    if (!territoryNames.includes(name)) territoryNames.push(name);
  }

  // Load contact's active pipeline positions — Phase 4 read migration: jps
  // via the contact's journey. For multi-territory pipelines (runway/
  // onboarding), the canonical NULL-territory row is preferred; otherwise
  // any active jps row. Logs are queried by the jps FK.
  const pipelinePositions: PipelinePosition[] = [];
  if (call.contact_id) {
    const { data: journey } = await supabase
      .from("journeys").select("id")
      .eq("primary_contact_id", call.contact_id).maybeSingle();

    if (journey?.id) {
      const { data: states } = await supabase
        .from("journey_pipeline_state")
        .select(`
          id,
          pipeline_id,
          territory_ms_slug,
          current_stage_id,
          current_sub_task_id,
          pipelines ( slug, name ),
          pipeline_stages ( slug, name )
        `)
        .eq("journey_id", journey.id)
        .eq("is_active", true);

      // Fold per-pipeline, NULL-territory preferred.
      type StateRow = NonNullable<typeof states>[number];
      const canonByPipeline = new Map<string, StateRow>();
      for (const st of states ?? []) {
        const existing = canonByPipeline.get(st.pipeline_id);
        if (!existing) { canonByPipeline.set(st.pipeline_id, st); continue; }
        if (st.territory_ms_slug === null && existing.territory_ms_slug !== null) {
          canonByPipeline.set(st.pipeline_id, st);
        }
      }

      for (const st of canonByPipeline.values()) {
        const pipeline = Array.isArray(st.pipelines) ? st.pipelines[0] : st.pipelines;
        const stage = Array.isArray(st.pipeline_stages) ? st.pipeline_stages[0] : st.pipeline_stages;
        if (!pipeline || !stage) continue;

        const { data: allStageRows } = await supabase
          .from("pipeline_stages")
          .select("name")
          .eq("pipeline_id", st.pipeline_id)
          .order("sort_order", { ascending: true });

        const { data: subTaskRows } = await supabase
          .from("pipeline_sub_tasks")
          .select("id, name")
          .eq("stage_id", st.current_stage_id)
          .order("sort_order", { ascending: true });

        const subTaskIds = (subTaskRows ?? []).map((s) => s.id);
        let completedIds = new Set<string>();
        if (subTaskIds.length > 0) {
          const { data: logs } = await supabase
            .from("contact_sub_task_logs")
            .select("sub_task_id")
            .eq("journey_pipeline_state_id", st.id)
            .in("sub_task_id", subTaskIds);
          completedIds = new Set((logs ?? []).map((l) => l.sub_task_id));
        }

        pipelinePositions.push({
          pipelineName: (pipeline as { name: string }).name,
          pipelineSlug: (pipeline as { slug: string }).slug,
          currentStage: (stage as { name: string }).name,
          allStages: (allStageRows ?? []).map((s) => s.name),
          subTasks: (subTaskRows ?? []).map((s) => ({
            name: s.name,
            completed: completedIds.has(s.id),
          })),
        });
      }
    }
  }

  // Load feedback patterns for the learning loop
  const feedback = await retrieveFeedback({
    callTypeSlug,
    contactId: call.contact_id,
  });

  // Determine if team/group call (no specific external contact focus)
  const isTeamCall = callTypeSlug === "team_call" || callTypeSlug === "internal"
    || callTypeSlug === "group_call" || callTypeSlug === "cohort_call"
    || (contactNames.length === 0 && teamMembers.length >= 2);

  // For team/group calls: load a lightweight roster of all active contacts + territories
  // so the LLM can match names mentioned in the transcript
  const roster: RosterEntry[] = [];
  if (isTeamCall) {
    // Load active franchisees (in onboarding or runway) — Phase 4 read
    // migration: source from jps and resolve contact via journey primary.
    const { data: franchiseeStates } = await supabase
      .from("journey_pipeline_state")
      .select("pipeline_id, current_stage_id, journeys!inner(primary_contact_id)")
      .eq("is_active", true)
      .in("pipeline_id", [
        "a0000000-0000-0000-0000-000000000003", // onboarding
        "a0000000-0000-0000-0000-000000000004", // runway
      ]);

    const fContactIds = [...new Set((franchiseeStates ?? []).map((s) => {
      const j = s.journeys as unknown as { primary_contact_id: string } | null;
      return j?.primary_contact_id ?? null;
    }).filter(Boolean) as string[])];
    if (fContactIds.length > 0) {
      const { data: fContacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .in("id", fContactIds);

      // Get their territories
      const { data: fOwners } = await supabase
        .from("territory_owners")
        .select("ghl_contact_id, ms_slug, territories ( territory_name )")
        .is("end_date", null);

      // Map contact_id → ghl_contact_id
      const { data: fGhlMap } = await supabase
        .from("contacts")
        .select("id, ghl_contact_id")
        .in("id", fContactIds);
      const idToGhl = new Map((fGhlMap ?? []).map((c) => [c.id, c.ghl_contact_id]));

      // Map ghl_contact_id → territory name
      const ghlToTerritory = new Map<string, string>();
      for (const o of fOwners ?? []) {
        const t = Array.isArray(o.territories) ? o.territories[0] : o.territories;
        ghlToTerritory.set(o.ghl_contact_id, (t as { territory_name: string } | null)?.territory_name ?? o.ms_slug);
      }

      // Get pipeline stage names
      const stageIds = [...new Set((franchiseeStates ?? []).map((s) => s.current_stage_id))];
      const { data: stageRows } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .in("id", stageIds);
      const stageMap = new Map((stageRows ?? []).map((s) => [s.id, s.name]));

      const contactStageMap = new Map<string, string>();
      for (const s of franchiseeStates ?? []) {
        const j = s.journeys as unknown as { primary_contact_id: string } | null;
        const cid = j?.primary_contact_id;
        if (cid) contactStageMap.set(cid, stageMap.get(s.current_stage_id) ?? "Unknown");
      }

      for (const c of fContacts ?? []) {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
        const ghlId = idToGhl.get(c.id);
        roster.push({
          name,
          role: "franchisee",
          pipelineStage: contactStageMap.get(c.id) ?? null,
          territory: ghlId ? (ghlToTerritory.get(ghlId) ?? null) : null,
        });
      }
    }

    // Load active prospects (in sales pipeline) — source via jps + journey.
    const { data: prospectStates } = await supabase
      .from("journey_pipeline_state")
      .select("current_stage_id, journeys!inner(primary_contact_id)")
      .eq("is_active", true)
      .eq("pipeline_id", "a0000000-0000-0000-0000-000000000001"); // sales

    const pContactIds = [...new Set((prospectStates ?? []).map((s) => {
      const j = s.journeys as unknown as { primary_contact_id: string } | null;
      return j?.primary_contact_id ?? null;
    }).filter(Boolean) as string[])];
    if (pContactIds.length > 0) {
      const { data: pContacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .in("id", pContactIds.slice(0, 100)); // Cap at 100 for token budget

      const pStageIds = [...new Set((prospectStates ?? []).map((s) => s.current_stage_id))];
      const { data: pStageRows } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .in("id", pStageIds);
      const pStageMap = new Map((pStageRows ?? []).map((s) => [s.id, s.name]));

      const pContactStageMap = new Map<string, string>();
      for (const s of prospectStates ?? []) {
        const j = s.journeys as unknown as { primary_contact_id: string } | null;
        const cid = j?.primary_contact_id;
        if (cid) pContactStageMap.set(cid, pStageMap.get(s.current_stage_id) ?? "Unknown");
      }

      for (const c of pContacts ?? []) {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
        roster.push({
          name,
          role: "prospect",
          pipelineStage: pContactStageMap.get(c.id) ?? null,
          territory: null,
        });
      }
    }
  }

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
    pipelinePositions,
    feedbackBlock: feedback.promptBlock,
    contactNames,
    territoryNames,
    callTerritories,
    roster,
    isTeamCall,
  };
}

// ── Territory resolution helpers ──────────────────────────

/** Build a map of territory_name (lowercase) → ms_slug and ms_slug (lowercase) → ms_slug */
async function buildTerritoryMap(
  supabase: ReturnType<typeof createServerClient>
): Promise<Map<string, string>> {
  const { data: territories } = await supabase
    .from("territories")
    .select("ms_slug, territory_name");

  const map = new Map<string, string>();
  for (const t of territories ?? []) {
    // Exact matches on both name and slug
    map.set(t.territory_name.toLowerCase(), t.ms_slug);
    map.set(t.ms_slug.toLowerCase(), t.ms_slug);
  }
  return map;
}

/** Resolve a territory name/slug to ms_slug. Exact match only — no fuzzy matching. */
function resolveTerritory(name: string, map: Map<string, string>): string | null {
  return map.get(name.toLowerCase()) ?? null;
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
    callUpdate.summary_bullets = results.summary.bullets.length > 0 ? results.summary.bullets : null;
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

  // Resolve the journey for the call's primary contact (Phase 2 tagging).
  // Cached once and reused across action items + extractions.
  const primaryJourneyId = contactId
    ? (await supabase.from("journeys").select("id").eq("primary_contact_id", contactId).maybeSingle()).data?.id ?? null
    : null;

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
      journey_id: primaryJourneyId,
      category: a.category,
      title: a.title,
      description: a.description ?? null,
      why: a.why ?? null,
      contact_name: a.contact_name ?? null,
      assigned_to_name: a.assigned_to_name ?? null,
      metadata: a.metadata ?? null,
      source: "scout",
      ghl_action: a.ghl_action ?? false,
      status: "pending",
    }));

    const { error: insertErr } = await supabase.from("call_action_items").insert(rows);
    if (insertErr) {
      console.error("[agent] call_action_items insert failed:", insertErr.message, insertErr.details);
    }
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

    // Build a name → contact_id map for multi-contact resolution
    const { data: callParticipants } = await supabase
      .from("call_participants")
      .select("contact_id, display_name")
      .eq("call_id", callId)
      .in("role", ["prospect", "franchisee"]);

    const nameToContactId = new Map<string, string>();
    for (const p of callParticipants ?? []) {
      if (p.contact_id && p.display_name) {
        nameToContactId.set(p.display_name.toLowerCase(), p.contact_id);
      }
    }
    // Also resolve full names from contacts table
    const pContactIds = (callParticipants ?? []).map((p) => p.contact_id).filter(Boolean) as string[];
    if (pContactIds.length > 0) {
      const { data: contacts } = await supabase.from("contacts").select("id, first_name, last_name").in("id", pContactIds);
      for (const c of contacts ?? []) {
        const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim().toLowerCase();
        if (fullName) nameToContactId.set(fullName, c.id);
        if (c.last_name) nameToContactId.set(c.last_name.toLowerCase(), c.id);
      }
    }

    // Ensure field_category is valid per DB constraint
    const validCategories = new Set(["contact", "contact_eos", "territory", "territory_eos", "territory_market", "market", "business_financials", "business_health"]);

    // Build a territory name/slug → slug map, scoped to this call's mapped
    // territories first so the LLM's names always resolve to valid slugs.
    const territoryMap = await buildTerritoryMap(supabase);
    const { data: callTerritoryRows } = await supabase
      .from("call_territories")
      .select("territory_ms_slug, is_primary, territories ( territory_name )")
      .eq("call_id", callId)
      .order("is_primary", { ascending: false });
    const callTerritoryPrimary =
      (callTerritoryRows ?? []).find((r) => r.is_primary)?.territory_ms_slug ?? null;

    // Journey cache — resolve once per contact_id used in extractions.
    const contactIdsInPlay = new Set<string>();
    if (contactId) contactIdsInPlay.add(contactId);
    for (const cid of nameToContactId.values()) contactIdsInPlay.add(cid);
    const journeyByContact = new Map<string, string | null>();
    if (contactIdsInPlay.size > 0) {
      const { data: js } = await supabase
        .from("journeys")
        .select("id, primary_contact_id")
        .in("primary_contact_id", [...contactIdsInPlay]);
      for (const j of js ?? []) journeyByContact.set(j.primary_contact_id, j.id);
    }

    const rows = results.extractions.extractions
      .filter((e) => e.extracted_value !== null)
      .filter((e) => validCategories.has(e.field_category))
      .map((e) => {
        // Resolve contact_id from target_contact_name if provided
        let resolvedContactId = contactId;
        if (e.target_contact_name) {
          const matched = nameToContactId.get(e.target_contact_name.toLowerCase());
          if (matched) resolvedContactId = matched;
        }

        // Resolve territory_ms_slug from target_territory if provided. If the
        // LLM leaves it blank on a territory-category extraction, fall back to
        // the call's primary territory so reports don't lose the datapoint.
        let resolvedTerritorySlug: string | null = null;
        if (e.target_territory) {
          resolvedTerritorySlug = resolveTerritory(e.target_territory, territoryMap);
        }
        if (!resolvedTerritorySlug && e.field_category.startsWith("territory")) {
          resolvedTerritorySlug = callTerritoryPrimary;
        }

        // Tag the journey from the resolved contact (falls back to the
        // call's primary journey when the target contact isn't enrolled).
        const resolvedJourneyId =
          (resolvedContactId ? journeyByContact.get(resolvedContactId) : null) ?? primaryJourneyId;

        return {
          call_id: callId,
          contact_id: resolvedContactId ?? null,
          journey_id: resolvedJourneyId,
          field_key: e.field_key,
          field_category: e.field_category,
          extracted_value: e.extracted_value,
          confidence: e.confidence,
          source: "scout",
          territory_ms_slug: resolvedTerritorySlug,
        };
      })
      // Data-lake integrity: drop any row that couldn't be scoped to a
      // contact, journey, or territory. These are typically team-call
      // mashups where Scout couldn't attribute the fact to a specific
      // prospect. Without a scope pointer the predictive LLM can't use
      // the row downstream, and the chk_extraction_has_scope constraint
      // would reject it anyway.
      .filter((r) => r.contact_id || r.journey_id || r.territory_ms_slug);

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from("call_data_extractions").insert(rows);
      if (insertErr) {
        console.error("[agent] call_data_extractions insert failed:", insertErr.message, insertErr.details);
      }

      // No auto-sync — all extractions stay in call_data_extractions as pending.
      // User manually reviews each one in the Data tab and pushes or skips.
    }
  }
}
