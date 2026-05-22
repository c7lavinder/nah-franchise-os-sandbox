/**
 * Contact Brief Generator — Phase 2 of the Retrieval Brain
 *
 * Pulls profile fields, call history, intelligence scores, pipeline state,
 * objections, and territory link into a pre-computed JSON brief + text summary.
 * Stored in contact_briefs table for instant retrieval by Scout.
 */

import { createServerClient } from "@/lib/supabase/server";
import { getContactProfileFields } from "@/lib/profile/profile-fields";
import { embedBriefSummary } from "@/lib/rag/embedder";

export interface ContactBrief {
  contactId: string;
  name: string;
  identity: {
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    occupation: string | null;
    discType: string | null;
    communicationStyle: string | null;
  };
  pipeline: {
    pipelineName: string | null;
    stageName: string | null;
    daysInStage: number;
    subTasksComplete: number;
    subTasksTotal: number;
  } | null;
  intelligence: {
    totalScore: number;
    financial: number;
    operational: number;
    engagement: number;
    momentum: number;
    ghostRisk: string | null;
    closeProb: string | null;
  } | null;
  financials: {
    liquidCapital: string | null;
    fundingPath: string | null;
    investmentTimeline: string | null;
  };
  recentCalls: Array<{
    date: string | null;
    type: string | null;
    summary: string | null;
  }>;
  unresolvedObjections: Array<{
    type: string;
    detail: string | null;
  }>;
  territorySlug: string | null;
  profileFieldCount: number;
}

export async function generateContactBrief(contactId: string): Promise<{
  brief: ContactBrief;
  summary: string;
}> {
  const supabase = createServerClient();

  // Parallel fetch all data sources
  const [contactRes, profileFields, pipelineRes, intelRes, callsRes, objectionsRes, territoryRes] = await Promise.all([
    supabase.from("contacts").select("first_name, last_name, email, phone, city, state").eq("id", contactId).single(),
    getContactProfileFields(contactId),
    // Pipeline state via journey
    (async () => {
      const { data } = await supabase
        .from("journey_pipeline_state")
        .select(
          `
          current_stage_id, entered_current_stage_at,
          pipelines (name),
          pipeline_stages (name),
          journeys!inner(primary_contact_id)
        `
        )
        .eq("journeys.primary_contact_id", contactId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      return data;
    })(),
    supabase.from("candidate_intelligence").select("*").eq("contact_id", contactId).single(),
    supabase
      .from("call_participants")
      .select("calls!inner(started_at, ai_summary, call_types(name))")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("objection_registry")
      .select("objection_type, objection_detail")
      .eq("contact_id", contactId)
      .eq("resolved", false),
    // Territory link via journey_pipeline_state
    supabase
      .from("journey_pipeline_state")
      .select(`"TerritorySlug", journeys!inner(primary_contact_id)`)
      .eq("journeys.primary_contact_id", contactId)
      .eq("is_active", true)
      .not("TerritorySlug", "is", null)
      .limit(1)
      .maybeSingle(),
  ]);

  const contact = contactRes.data;
  const name = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "Unknown";

  const pv = (fieldName: string): string | null => {
    const f = profileFields[fieldName];
    if (!f || f.field_value == null) return null;
    const val = f.field_value;
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return String(val);
  };

  // Pipeline
  let pipeline: ContactBrief["pipeline"] = null;
  if (pipelineRes) {
    const ps = pipelineRes as any;
    const enteredAt = new Date(ps.entered_current_stage_at);
    const daysInStage = Math.floor((Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24));

    const { count: total } = await supabase
      .from("pipeline_sub_tasks")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", ps.current_stage_id);
    const { count: complete } = await supabase
      .from("contact_sub_task_logs")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId)
      .is("deleted_at", null);

    pipeline = {
      pipelineName: ps.pipelines?.name ?? null,
      stageName: ps.pipeline_stages?.name ?? null,
      daysInStage,
      subTasksComplete: complete ?? 0,
      subTasksTotal: total ?? 0,
    };
  }

  // Intelligence
  const intel = intelRes.data as any;
  const intelligence: ContactBrief["intelligence"] = intel
    ? {
        totalScore: intel.current_score,
        financial: intel.score_financial,
        operational: intel.score_operational,
        engagement: intel.score_engagement,
        momentum: intel.score_momentum,
        ghostRisk: pv("ghost_risk"),
        closeProb: pv("Predicted Close Probability"),
      }
    : null;

  // Recent calls
  const recentCalls = ((callsRes.data ?? []) as any[]).map((cp) => {
    const call = Array.isArray(cp.calls) ? cp.calls[0] : cp.calls;
    const callType = call?.call_types;
    return {
      date: call?.started_at ?? null,
      type: (Array.isArray(callType) ? callType[0]?.name : callType?.name) ?? null,
      summary: call?.ai_summary ?? null,
    };
  });

  // Objections
  const unresolvedObjections = ((objectionsRes.data ?? []) as any[]).map((o) => ({
    type: o.objection_type,
    detail: o.objection_detail ?? null,
  }));

  const filledFieldCount = Object.values(profileFields).filter((f) => f.field_value != null).length;

  const brief: ContactBrief = {
    contactId,
    name,
    identity: {
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      city: contact?.city ?? null,
      state: contact?.state ?? null,
      occupation: pv("current_occupation"),
      discType: pv("disc_type"),
      communicationStyle: pv("communication_style"),
    },
    pipeline,
    intelligence,
    financials: {
      liquidCapital: pv("liquid_capital_available"),
      fundingPath: intel?.funding_path ?? null,
      investmentTimeline: pv("investment_timeline"),
    },
    recentCalls,
    unresolvedObjections,
    territorySlug: (territoryRes.data as any)?.TerritorySlug ?? null,
    profileFieldCount: filledFieldCount,
  };

  // Build text summary
  const lines: string[] = [];
  lines.push(`${name} — ${pipeline ? `${pipeline.stageName} (${pipeline.daysInStage}d)` : "No pipeline"}`);

  if (intelligence) {
    lines.push(
      `Score: ${intelligence.totalScore}/100 (F:${intelligence.financial} O:${intelligence.operational} E:${intelligence.engagement} M:${intelligence.momentum})`
    );
  }
  if (brief.financials.liquidCapital) lines.push(`Capital: ${brief.financials.liquidCapital}`);
  if (brief.identity.discType) lines.push(`DISC: ${brief.identity.discType}`);
  if (unresolvedObjections.length > 0) {
    lines.push(`Objections (${unresolvedObjections.length}): ${unresolvedObjections.map((o) => o.type).join(", ")}`);
  }
  if (recentCalls.length > 0 && recentCalls[0].date) {
    lines.push(`Last call: ${recentCalls[0].date.split("T")[0]} (${recentCalls[0].type ?? "unknown"})`);
  }
  if (brief.territorySlug) lines.push(`Territory: ${brief.territorySlug}`);
  lines.push(`Profile fields: ${filledFieldCount} populated`);

  return { brief, summary: lines.join("\n") };
}

/**
 * Generate and store a contact brief. Returns the brief.
 */
export async function generateAndStoreContactBrief(contactId: string): Promise<ContactBrief> {
  const supabase = createServerClient();
  const { brief, summary } = await generateContactBrief(contactId);

  await supabase.from("contact_briefs").upsert(
    {
      contact_id: contactId,
      brief,
      summary,
      updated_at: new Date().toISOString(),
      stale: false,
    },
    { onConflict: "contact_id" }
  );

  // Embed brief summary into search index (fire-and-forget)
  embedBriefSummary({
    contactId,
    entityType: "contact",
    entityId: contactId,
    entityName: brief.name,
    summary,
  }).catch((err) => {
    console.error(`Failed to embed contact brief for ${contactId}:`, err);
  });

  return brief;
}
