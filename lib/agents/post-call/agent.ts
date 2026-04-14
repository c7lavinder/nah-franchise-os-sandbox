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

  // Idempotency guard: if this call already has a summary, skip re-generation
  const { data: callRow } = await supabase
    .from("calls")
    .select("ai_summary_generated_at")
    .eq("id", callId)
    .single();
  if (callRow?.ai_summary_generated_at) {
    console.warn(`[post-call-agent] callId=${callId} already processed (ai_summary_generated_at=${callRow.ai_summary_generated_at}) — skipping`);
    return { success: true, summary: "already_generated", coaching: null, actionsCount: 0, extractionsCount: 0, kbDocsUpdated: 0, errors: [] };
  }

  // 2. Run all 5 sections in parallel
  const [summaryRes, coachingRes, actionsRes, extractionsRes, kbRes] = await Promise.allSettled([
    runSummary(context, MODELS.summary),
    runCoaching(context, MODELS.coaching),
    runNextSteps(context, MODELS.nextSteps),
    runExtraction(context, MODELS.extraction),
    runKBIntelligence(context, MODELS.kbIntelligence),
  ]);

  const summary = summaryRes.status === "fulfilled" ? summaryRes.value : null;
  const coaching = coachingRes.status === "fulfilled" ? coachingRes.value : null;
  const actions = actionsRes.status === "fulfilled" ? actionsRes.value : null;
  const extractions = extractionsRes.status === "fulfilled" ? extractionsRes.value : null;
  const kbIntelligence = kbRes.status === "fulfilled" ? kbRes.value : null;

  // Collect errors for diagnostics — include null results (parse failures)
  const errors: string[] = [];
  if (summaryRes.status === "rejected") errors.push(`summary: ${String(summaryRes.reason)}`);
  else if (!summary) errors.push("summary: returned null (parse failure)");
  if (coachingRes.status === "rejected") errors.push(`coaching: ${String(coachingRes.reason)}`);
  else if (!coaching) errors.push("coaching: returned null (parse failure)");
  if (actionsRes.status === "rejected") errors.push(`actions: ${String(actionsRes.reason)}`);
  else if (!actions) errors.push("actions: returned null (parse failure)");
  if (extractionsRes.status === "rejected") errors.push(`extractions: ${String(extractionsRes.reason)}`);
  else if (!extractions) errors.push("extractions: returned null (parse failure)");
  if (kbRes.status === "rejected") errors.push(`kb-intelligence: ${String(kbRes.reason)}`);
  else if (!kbIntelligence) errors.push("kb-intelligence: returned null (parse failure)");

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

  // Load contact's active pipeline positions
  const pipelinePositions: PipelinePosition[] = [];
  if (call.contact_id) {
    const { data: states } = await supabase
      .from("contact_pipeline_state")
      .select(`
        id,
        pipeline_id,
        current_stage_id,
        current_sub_task_id,
        pipelines ( slug, name ),
        pipeline_stages ( slug, name )
      `)
      .eq("contact_id", call.contact_id)
      .eq("is_active", true);

    for (const st of states ?? []) {
      const pipeline = Array.isArray(st.pipelines) ? st.pipelines[0] : st.pipelines;
      const stage = Array.isArray(st.pipeline_stages) ? st.pipeline_stages[0] : st.pipeline_stages;
      if (!pipeline || !stage) continue;

      // Fetch all stages for this pipeline
      const { data: allStageRows } = await supabase
        .from("pipeline_stages")
        .select("name")
        .eq("pipeline_id", st.pipeline_id)
        .order("sort_order", { ascending: true });

      // Fetch sub-tasks for the current stage
      const { data: subTaskRows } = await supabase
        .from("pipeline_sub_tasks")
        .select("id, name")
        .eq("stage_id", st.current_stage_id)
        .order("sort_order", { ascending: true });

      // Check which sub-tasks are completed via logs
      const subTaskIds = (subTaskRows ?? []).map((s) => s.id);
      let completedIds = new Set<string>();
      if (subTaskIds.length > 0) {
        const { data: logs } = await supabase
          .from("contact_sub_task_logs")
          .select("sub_task_id")
          .eq("contact_pipeline_state_id", st.id)
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
    // Load active franchisees (in onboarding or runway)
    const { data: franchiseeStates } = await supabase
      .from("contact_pipeline_state")
      .select("contact_id, pipeline_id, current_stage_id")
      .eq("is_active", true)
      .in("pipeline_id", [
        "a0000000-0000-0000-0000-000000000003", // onboarding
        "a0000000-0000-0000-0000-000000000004", // runway
      ]);

    const fContactIds = [...new Set((franchiseeStates ?? []).map((s) => s.contact_id))];
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
        contactStageMap.set(s.contact_id, stageMap.get(s.current_stage_id) ?? "Unknown");
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

    // Load active prospects (in sales pipeline)
    const { data: prospectStates } = await supabase
      .from("contact_pipeline_state")
      .select("contact_id, current_stage_id")
      .eq("is_active", true)
      .eq("pipeline_id", "a0000000-0000-0000-0000-000000000001"); // sales

    const pContactIds = [...new Set((prospectStates ?? []).map((s) => s.contact_id))];
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
        pContactStageMap.set(s.contact_id, pStageMap.get(s.current_stage_id) ?? "Unknown");
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

        return {
          call_id: callId,
          contact_id: resolvedContactId ?? null,
          field_key: e.field_key,
          field_category: e.field_category,
          extracted_value: e.extracted_value,
          confidence: e.confidence,
          source: "scout",
        };
      });

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from("call_data_extractions").insert(rows);
      if (insertErr) {
        console.error("[agent] call_data_extractions insert failed:", insertErr.message, insertErr.details);
      }

      // Auto-sync high-confidence contact extractions to contact_profile_data
      // This ensures the master contact profile stays current
      const contactExtractions = rows.filter(
        (r) => r.field_category === "contact" && r.contact_id && r.confidence === "high"
      );

      // Fields that map to contact_profile_data columns
      const PROFILE_FIELDS = new Set([
        "liquid_capital", "financing_type", "net_worth_estimate", "guidant_robs_active",
        "pfs_received", "desired_territory", "market_area", "secondary_territory",
        "territory_value_est", "zip_codes_of_interest", "local_market_notes",
        "competitor_notes", "primary_motivation", "definition_of_success",
        "objections_raised", "decision_style", "prior_re_experience", "skill_set_notes",
      ]);

      // Fields that map to the contacts table directly
      const CONTACTS_FIELDS = new Set([
        "first_name", "last_name", "email", "phone", "city", "state", "zip", "address",
      ]);

      // Group extractions by contact_id
      const byContact = new Map<string, typeof contactExtractions>();
      for (const row of contactExtractions) {
        const existing = byContact.get(row.contact_id!) ?? [];
        existing.push(row);
        byContact.set(row.contact_id!, existing);
      }

      for (const [cId, extractions] of byContact) {
        // Get ghl_contact_id for contact_profile_data (keyed by ghl_contact_id)
        const { data: contact } = await supabase
          .from("contacts")
          .select("ghl_contact_id")
          .eq("id", cId)
          .single();

        if (!contact?.ghl_contact_id) continue;

        // Update contact_profile_data
        const profileUpdates: Record<string, unknown> = {};
        for (const ext of extractions) {
          if (PROFILE_FIELDS.has(ext.field_key)) {
            // Convert boolean-like values
            if (ext.field_key === "guidant_robs_active" || ext.field_key === "pfs_received") {
              profileUpdates[ext.field_key] = ext.extracted_value?.toLowerCase() === "yes" || ext.extracted_value?.toLowerCase() === "true";
            } else if (["liquid_capital", "net_worth_estimate", "territory_value_est"].includes(ext.field_key)) {
              // Extract numeric value from strings like "$150,000"
              const num = parseFloat((ext.extracted_value ?? "").replace(/[$,]/g, ""));
              if (!isNaN(num)) profileUpdates[ext.field_key] = num;
            } else {
              profileUpdates[ext.field_key] = ext.extracted_value;
            }
          }
        }

        if (Object.keys(profileUpdates).length > 0) {
          await supabase
            .from("contact_profile_data")
            .upsert(
              { ghl_contact_id: contact.ghl_contact_id, ...profileUpdates },
              { onConflict: "ghl_contact_id" }
            );
        }

        // Update contacts table for basic fields
        const contactUpdates: Record<string, unknown> = {};
        for (const ext of extractions) {
          if (CONTACTS_FIELDS.has(ext.field_key) && ext.extracted_value) {
            contactUpdates[ext.field_key] = ext.extracted_value;
          }
        }

        if (Object.keys(contactUpdates).length > 0) {
          await supabase.from("contacts").update(contactUpdates).eq("id", cId);
        }

        // Mark these extractions as saved to profile
        const savedKeys = [...Object.keys(profileUpdates), ...Object.keys(contactUpdates)];
        if (savedKeys.length > 0) {
          await supabase
            .from("call_data_extractions")
            .update({ saved_to_profile: true })
            .eq("call_id", callId)
            .eq("contact_id", cId)
            .in("field_key", savedKeys)
            .eq("confidence", "high");
        }
      }

      // Auto-sync high-confidence territory_market extractions to territory_market_data
      // Use original extraction results (not rows) to access target_territory
      const marketExtractions = results.extractions.extractions.filter(
        (e) => e.field_category === "territory_market" && e.confidence === "high" && e.extracted_value
      );

      if (marketExtractions.length > 0) {
        const territoryNameToSlug = await buildTerritoryMap(supabase);

        // Fallback: if contact has a territory_slug, use it for untagged extractions
        let fallbackSlug: string | null = null;
        if (contactId) {
          const { data: ctct } = await supabase
            .from("contacts")
            .select("territory_slug")
            .eq("id", contactId)
            .single();
          fallbackSlug = ctct?.territory_slug ?? null;
        }

        let synced = 0;
        let skipped = 0;
        for (const ext of marketExtractions) {
          const tName = ext.target_territory;
          const slug = tName ? resolveTerritory(tName, territoryNameToSlug) : fallbackSlug;
          if (!slug) {
            console.warn(`[post-call-agent] callId=${callId} SKIPPED market extraction: field=${ext.field_key} territory="${tName}" — no match found`);
            skipped++;
            continue;
          }

          await supabase
            .from("territory_market_data")
            .upsert(
              { territory_slug: slug, field_name: ext.field_key, field_value: ext.extracted_value, source: "scout" },
              { onConflict: "territory_slug,field_name" }
            );
          synced++;
        }
        if (skipped > 0) console.warn(`[post-call-agent] callId=${callId} territory_market: ${synced} synced, ${skipped} skipped (unresolved territory)`);
      }

      // Auto-sync contact_eos extractions (goals, issues, todos)
      const contactEosExtractions = results.extractions.extractions.filter(
        (e) => e.field_category === "contact_eos" && e.confidence === "high" && e.extracted_value
      );

      if (contactEosExtractions.length > 0) {
        let eosSkipped = 0;
        for (const ext of contactEosExtractions) {
          let targetContactId = contactId;
          if (ext.target_contact_name) {
            const matched = nameToContactId.get(ext.target_contact_name.toLowerCase());
            if (matched) targetContactId = matched;
          }
          if (!targetContactId) {
            console.warn(`[post-call-agent] callId=${callId} SKIPPED contact_eos: field=${ext.field_key} contact="${ext.target_contact_name}" — no match`);
            eosSkipped++;
            continue;
          }

          if (ext.field_key === "income_goal" || ext.field_key === "lifestyle_goal" || ext.field_key === "qol_goal") {
            // Upsert to eos_contact_goals
            await supabase.from("eos_contact_goals").upsert(
              { contact_id: targetContactId, [ext.field_key]: ext.extracted_value, source: "ai" },
              { onConflict: "contact_id" }
            );
          } else if (ext.field_key === "issue") {
            await supabase.from("eos_contact_issues").insert({
              contact_id: targetContactId,
              issue_text: ext.extracted_value,
              source: "ai",
            });
          } else if (ext.field_key === "todo") {
            await supabase.from("eos_contact_todos").insert({
              contact_id: targetContactId,
              todo_text: ext.extracted_value,
              source: "ai",
            });
          }
        }
      }

      // Auto-sync territory_eos extractions (rocks, issues, todos, scorecard, habits)
      const territoryEosExtractions = results.extractions.extractions.filter(
        (e) => e.field_category === "territory_eos" && e.confidence === "high" && e.extracted_value
      );

      if (territoryEosExtractions.length > 0) {
        const tEosMap = await buildTerritoryMap(supabase);

        let eosTFallbackSlug: string | null = null;
        if (contactId) {
          const { data: ctct } = await supabase
            .from("contacts")
            .select("territory_slug")
            .eq("id", contactId)
            .single();
          eosTFallbackSlug = ctct?.territory_slug ?? null;
        }

        const now = new Date();
        let tEosSynced = 0;
        let tEosSkipped = 0;
        for (const ext of territoryEosExtractions) {
          const tName = ext.target_territory;
          const slug = tName ? resolveTerritory(tName, tEosMap) : eosTFallbackSlug;
          if (!slug) {
            console.warn(`[post-call-agent] callId=${callId} SKIPPED territory_eos: field=${ext.field_key} territory="${tName}" — no match`);
            tEosSkipped++;
            continue;
          }
          tEosSynced++;

          if (ext.field_key === "rock") {
            await supabase.from("eos_territory_rocks").insert({
              territory_slug: slug,
              rock_text: ext.extracted_value,
              quarter: Math.ceil((now.getMonth() + 1) / 3),
              year: now.getFullYear(),
            });
          } else if (ext.field_key === "territory_issue") {
            await supabase.from("eos_territory_issues").insert({
              territory_slug: slug,
              issue_text: ext.extracted_value,
              source: "ai",
            });
          } else if (ext.field_key === "territory_todo") {
            await supabase.from("eos_territory_todos").insert({
              territory_slug: slug,
              todo_text: ext.extracted_value,
              source: "ai",
            });
          } else if (ext.field_key === "scorecard_goal") {
            // field_key like "t3_leads_entered" in extracted_value context
            // The LLM should put the metric_key in target_contact_name (overloaded)
            // or we try to parse it — skip for now unless format is clear
          } else if (ext.field_key === "habit_grade") {
            // Similar — field needs a habit_key identifier
            // Skip auto-sync for habits/scorecard — handled via manual or Scout draft tool
          }
        }
        if (tEosSkipped > 0) console.warn(`[post-call-agent] callId=${callId} territory_eos: ${tEosSynced} synced, ${tEosSkipped} skipped`);
      }
    }
  }
}
