/**
 * Journey Brief Agent
 *
 * Generates AI narrative summaries + deterministic next actions for franchise journeys.
 * Stored in journey_briefs table. Event-driven: only regenerates when something material
 * happens (call graded, stage changed, property synced).
 *
 * Uses Claude Haiku 4.5 for the narrative. Next actions are deterministic (no LLM).
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { getContactProfileFields } from "@/lib/profile/profile-fields";
import { embedBriefSummary } from "@/lib/rag/embedder";

export interface JourneyBriefData {
  narrative: string;
  nextActions: {
    primary: string;
    secondary: string[];
  };
}

interface JourneyRow {
  id: string;
  name: string;
  status: string;
  primary_contact_id: string;
  created_at: string;
}

const BRIEF_PROMPT = `You are Scout, the AI brain behind the New Again Houses franchise sales platform.
Write a 3-4 sentence narrative summary of this franchise journey. Be concrete — use names, dates, numbers.
Do not speculate or invent data. If data is missing, skip it rather than guessing.

Focus on:
- Who they are and when they entered the pipeline
- Where they stand now (stage, territory, engagement)
- Key signals (call quality, objections, property performance if franchisee)
- Any notable momentum or risk

Keep it conversational but professional. This will be read by the sales team before meetings.`;

export async function generateJourneyBrief(journeyId: string): Promise<JourneyBriefData | null> {
  const supabase = createServerClient();

  // --- 1. Parallel data fetch ---
  const [journeyRes, membersRes, pipelineRes, territorySlugs] = await Promise.all([
    supabase.from("journeys").select("id, name, status, primary_contact_id, created_at").eq("id", journeyId).single(),
    supabase
      .from("journey_contacts")
      .select("contact_id, role, contacts(first_name, last_name, email, phone, city, state)")
      .eq("journey_id", journeyId)
      .is("left_at", null),
    supabase
      .from("journey_pipeline_state")
      .select(
        `id, current_stage_id, entered_current_stage_at, is_active, "TerritorySlug",
         pipelines(name), pipeline_stages(name)`
      )
      .eq("journey_id", journeyId),
    // Get all territory slugs for this journey
    supabase
      .from("journey_pipeline_state")
      .select(`"TerritorySlug"`)
      .eq("journey_id", journeyId)
      .not("TerritorySlug", "is", null),
  ]);

  const journey = journeyRes.data as JourneyRow | null;
  if (!journey) return null;

  const primaryContactId = journey.primary_contact_id;
  const slugs = ((territorySlugs.data ?? []) as any[]).map((r) => r.TerritorySlug).filter(Boolean) as string[];

  // Second wave: data that depends on primaryContactId / slugs
  const [callsRes, intelRes, objectionsRes, profileFields, inventoryRes, tasksRes] = await Promise.all([
    // Recent calls with grades
    supabase
      .from("call_participants")
      .select(
        `calls!inner(id, title, started_at, duration_seconds, status, ai_summary,
         call_grades(overall_grade, overall_score, suggested_next_action),
         call_types(name))`
      )
      .eq("contact_id", primaryContactId)
      .order("created_at", { ascending: false })
      .limit(5),
    // Intelligence scores
    supabase.from("candidate_intelligence").select("*").eq("contact_id", primaryContactId).maybeSingle(),
    // Unresolved objections
    supabase
      .from("objection_registry")
      .select("objection_type, objection_detail")
      .eq("contact_id", primaryContactId)
      .eq("resolved", false),
    // Profile fields
    getContactProfileFields(primaryContactId),
    // MasterSuite inventory count (if franchisee with territory)
    slugs.length > 0
      ? supabase
          .from("ms_property_inventory")
          .select(`"PropertyId", "Inv_Status", "Inv_PurchaseDate", "Inv_SellDate"`)
          .in(
            "PropertyId",
            // Sub-query: get PropertyIds for these territories
            (await supabase.from("ms_properties").select(`"PropertyId"`).in("TerritorySlug", slugs)).data?.map(
              (r: any) => r.PropertyId
            ) ?? []
          )
      : Promise.resolve({ data: null }),
    // Overdue/pending tasks
    supabase
      .from("commitments")
      .select("commitment_text, due_date, status, commitment_type")
      .eq("contact_id", primaryContactId)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(10),
  ]);

  // --- 2. Assemble context for LLM ---
  const members = ((membersRes.data ?? []) as any[]).map((m) => {
    const c = Array.isArray(m.contacts) ? m.contacts[0] : m.contacts;
    return {
      name: `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Unknown",
      role: m.role,
      city: c?.city ?? null,
      state: c?.state ?? null,
    };
  });

  const pipelineStates = ((pipelineRes.data ?? []) as any[]).map((ps) => {
    const enteredAt = new Date(ps.entered_current_stage_at);
    const daysInStage = Math.floor((Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24));
    return {
      pipeline: (Array.isArray(ps.pipelines) ? ps.pipelines[0]?.name : ps.pipelines?.name) ?? "Unknown",
      stage: (Array.isArray(ps.pipeline_stages) ? ps.pipeline_stages[0]?.name : ps.pipeline_stages?.name) ?? "Unknown",
      territory: ps.TerritorySlug ?? null,
      daysInStage,
      isActive: ps.is_active,
    };
  });

  const calls = ((callsRes.data ?? []) as any[]).map((cp) => {
    const call = Array.isArray(cp.calls) ? cp.calls[0] : cp.calls;
    const grade = Array.isArray(call?.call_grades) ? call.call_grades[0] : call?.call_grades;
    const callType = Array.isArray(call?.call_types) ? call.call_types[0] : call?.call_types;
    return {
      date: call?.started_at ? new Date(call.started_at).toLocaleDateString() : null,
      type: callType?.name ?? null,
      grade: grade?.overall_grade ?? null,
      summary: call?.ai_summary?.substring(0, 200) ?? null,
      suggestedAction: grade?.suggested_next_action ?? null,
    };
  });

  const intel = intelRes.data as any;
  const objections = ((objectionsRes.data ?? []) as any[]).map((o) => ({
    type: o.objection_type,
    detail: o.objection_detail ?? null,
  }));

  const inventory = (inventoryRes.data ?? []) as any[];
  const purchasedCount = inventory.filter((p: any) => p.Inv_PurchaseDate).length;
  const soldCount = inventory.filter((p: any) => p.Inv_SellDate).length;
  const activeCount = inventory.filter((p: any) => p.Inv_Status === "Active").length;

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

  const context = {
    journey: {
      name: journey.name,
      status: journey.status,
      startedAt: new Date(journey.created_at).toLocaleDateString(),
    },
    members,
    pipelineStates: pipelineStates.filter((ps) => ps.isActive),
    recentCalls: calls,
    intelligence: intel
      ? { score: intel.current_score, ghostRisk: pv("ghost_risk"), closeProb: pv("Predicted Close Probability") }
      : null,
    objections,
    inventory: slugs.length > 0 ? { totalPurchased: purchasedCount, totalSold: soldCount, active: activeCount } : null,
    profile: {
      occupation: pv("current_occupation"),
      liquidCapital: pv("liquid_capital_available"),
      discType: pv("disc_type"),
      source: pv("opportunity_source"),
    },
  };

  // --- 3. Call Claude for narrative ---
  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: process.env.SCOUT_MODEL ?? "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `${BRIEF_PROMPT}\n\nJourney data:\n${JSON.stringify(context, null, 2)}`,
      },
    ],
  });

  const narrative = message.content[0].type === "text" ? message.content[0].text : "";

  // --- 4. Deterministic next actions ---
  const nextActions = computeNextActions({
    calls,
    pipelineStates,
    objections,
    tasks: (tasksRes.data ?? []) as any[],
    inventory: { purchased: purchasedCount, sold: soldCount, active: activeCount },
    slugs,
  });

  return { narrative, nextActions };
}

interface NextActionInput {
  calls: { date: string | null; grade: string | null; suggestedAction: string | null }[];
  pipelineStates: { stage: string; daysInStage: number; territory: string | null }[];
  objections: { type: string; detail: string | null }[];
  tasks: { commitment_text: string; due_date: string | null; status: string }[];
  inventory: { purchased: number; sold: number; active: number };
  slugs: string[];
}

function computeNextActions(input: NextActionInput): { primary: string; secondary: string[] } {
  const actions: { priority: number; text: string }[] = [];
  const today = new Date();

  // Overdue tasks — highest priority
  for (const task of input.tasks) {
    if (task.due_date && new Date(task.due_date) < today) {
      const daysOverdue = Math.floor((today.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
      actions.push({
        priority: 100 + daysOverdue,
        text: `Follow up: "${task.commitment_text}" (${daysOverdue}d overdue)`,
      });
    }
  }

  // Days since last call
  if (input.calls.length > 0 && input.calls[0].date) {
    const lastCallDate = new Date(input.calls[0].date);
    const daysSince = Math.floor((today.getTime() - lastCallDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 14) {
      actions.push({ priority: 80 + daysSince, text: `Schedule call — ${daysSince} days since last contact` });
    }
    // Use suggested action from last graded call
    if (input.calls[0].suggestedAction) {
      actions.push({ priority: 70, text: input.calls[0].suggestedAction });
    }
  } else {
    actions.push({ priority: 90, text: "Schedule introductory call — no calls on record" });
  }

  // Unresolved objections
  if (input.objections.length > 0) {
    const topObjection = input.objections[0];
    actions.push({
      priority: 60,
      text: `Address ${topObjection.type} objection${topObjection.detail ? `: "${topObjection.detail.substring(0, 60)}"` : ""}`,
    });
  }

  // Stage velocity warning
  for (const ps of input.pipelineStates) {
    if (ps.daysInStage > 30) {
      actions.push({ priority: 50, text: `${ps.stage} for ${ps.daysInStage} days — review pipeline velocity` });
    }
  }

  // Pending tasks (not overdue)
  for (const task of input.tasks) {
    if (task.due_date && new Date(task.due_date) >= today) {
      actions.push({ priority: 30, text: `Upcoming: "${task.commitment_text}"` });
    }
  }

  // Sort by priority desc
  actions.sort((a, b) => b.priority - a.priority);

  const primary = actions[0]?.text ?? "No pressing actions";
  const secondary = actions.slice(1, 3).map((a) => a.text);

  return { primary, secondary };
}

/**
 * Generate and store a journey brief. Called by cron and stale triggers.
 */
export async function generateAndStoreJourneyBrief(journeyId: string): Promise<JourneyBriefData | null> {
  const supabase = createServerClient();
  const result = await generateJourneyBrief(journeyId);

  if (!result) return null;

  await supabase.from("journey_briefs").upsert(
    {
      journey_id: journeyId,
      narrative: result.narrative,
      next_actions: result.nextActions,
      data_snapshot: {},
      stale: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "journey_id" }
  );

  // Embed for RAG search (fire-and-forget)
  const { data: journey } = await supabase.from("journeys").select("name").eq("id", journeyId).single();

  embedBriefSummary({
    contactId: journeyId,
    entityType: "journey",
    entityId: journeyId,
    entityName: journey?.name ?? "Unknown Journey",
    summary: result.narrative,
  }).catch((err) => {
    console.error(`Failed to embed journey brief for ${journeyId}:`, err);
  });

  return result;
}
