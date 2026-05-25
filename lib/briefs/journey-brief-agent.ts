/**
 * Journey Brief Agent
 *
 * Generates AI narrative summaries + deterministic next actions for franchise journeys.
 * Stored in journey_briefs table. Event-driven: only regenerates when something material
 * happens (call graded, stage changed, property synced).
 *
 * Claude Haiku 4.5 writes the narrative (~2-3s). Next actions are deterministic.
 * Briefs are cached in DB — page loads read from cache (instant).
 * First-time generation happens inline on first page visit.
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

const BRIEF_PROMPT = `You are Scout, the AI franchise sales coach for New Again Houses.
Write a 3-4 sentence narrative summary of this franchise journey.
Be concrete — use names, dates, numbers. Do not speculate.
Keep it conversational but professional, like a quick verbal briefing before a meeting.
Focus on: who they are, where they stand, key signals, and any momentum or risk.
Respond with ONLY the narrative paragraph — no headers, no bullets, no labels.`;

export async function generateJourneyBrief(journeyId: string): Promise<JourneyBriefData | null> {
  const supabase = createServerClient();

  // --- 1. First wave: journey-level data ---
  const [journeyRes, membersRes, pipelineRes] = await Promise.all([
    supabase.from("journeys").select("id, name, status, primary_contact_id, created_at").eq("id", journeyId).single(),
    supabase
      .from("journey_contacts")
      .select("contact_id, role, contacts(first_name, last_name, city, state)")
      .eq("journey_id", journeyId)
      .is("left_at", null),
    supabase
      .from("journey_pipeline_state")
      .select(
        `id, current_stage_id, entered_current_stage_at, is_active, "TerritorySlug",
         pipelines(name), pipeline_stages(name)`
      )
      .eq("journey_id", journeyId),
  ]);

  const journey = journeyRes.data as JourneyRow | null;
  if (!journey) return null;

  const primaryContactId = journey.primary_contact_id;
  const slugs = ((pipelineRes.data ?? []) as any[]).map((r) => r.TerritorySlug).filter(Boolean) as string[];
  const uniqueSlugs = [...new Set(slugs)];

  // --- 2. Second wave: contact-dependent queries (all parallel) ---
  const [callsResult, intelRes, objectionsRes, profileFields, commitmentRes, inventoryCountRes] = await Promise.all([
    supabase
      .from("call_participants")
      .select(
        `calls!inner(id, started_at, ai_summary,
         call_grades(overall_grade, suggested_next_action),
         call_types(name))`
      )
      .eq("contact_id", primaryContactId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("candidate_intelligence").select("current_score").eq("contact_id", primaryContactId).maybeSingle(),
    supabase
      .from("objection_registry")
      .select("objection_type")
      .eq("contact_id", primaryContactId)
      .eq("resolved", false)
      .limit(5),
    getContactProfileFields(primaryContactId),
    supabase
      .from("commitments")
      .select("commitment_text, due_date, status")
      .eq("contact_id", primaryContactId)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(10),
    uniqueSlugs.length > 0
      ? supabase
          .from("ms_properties")
          .select(`"PropertyId"`, { count: "exact", head: true })
          .in("TerritorySlug", uniqueSlugs)
      : Promise.resolve({ count: 0 }),
  ]);

  // --- 3. Assemble context ---
  const members = ((membersRes.data ?? []) as any[]).map((m) => {
    const c = Array.isArray(m.contacts) ? m.contacts[0] : m.contacts;
    return {
      name: `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Unknown",
      role: m.role,
      city: c?.city ?? null,
      state: c?.state ?? null,
    };
  });

  const activePipelines = ((pipelineRes.data ?? []) as any[])
    .filter((ps) => ps.is_active)
    .map((ps) => {
      const enteredAt = new Date(ps.entered_current_stage_at);
      const daysInStage = Math.floor((Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24));
      return {
        pipeline: (Array.isArray(ps.pipelines) ? ps.pipelines[0]?.name : ps.pipelines?.name) ?? "Unknown",
        stage:
          (Array.isArray(ps.pipeline_stages) ? ps.pipeline_stages[0]?.name : ps.pipeline_stages?.name) ?? "Unknown",
        territory: ps.TerritorySlug ?? null,
        daysInStage,
      };
    });

  const calls = ((callsResult?.data ?? []) as any[]).map((cp) => {
    const call = Array.isArray(cp.calls) ? cp.calls[0] : cp.calls;
    const grade = Array.isArray(call?.call_grades) ? call.call_grades[0] : call?.call_grades;
    const callType = Array.isArray(call?.call_types) ? call.call_types[0] : call?.call_types;
    return {
      date: call?.started_at ? new Date(call.started_at).toLocaleDateString() : null,
      type: callType?.name ?? null,
      grade: grade?.overall_grade ?? null,
      summary: call?.ai_summary?.substring(0, 150) ?? null,
      suggestedAction: grade?.suggested_next_action ?? null,
    };
  });

  const intel = intelRes.data as any;
  const objections = ((objectionsRes.data ?? []) as any[]).map((o) => o.objection_type);
  const propertyCount = (inventoryCountRes as any)?.count ?? 0;

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

  // Compact context for Claude (keep token count low for speed)
  const context: Record<string, unknown> = {
    journey: { name: journey.name, started: new Date(journey.created_at).toLocaleDateString() },
    members: members.map((m) => `${m.name} (${m.role}${m.city ? `, ${m.city} ${m.state}` : ""})`),
    stage: activePipelines[0]
      ? `${activePipelines[0].stage}${activePipelines[0].territory ? ` / ${activePipelines[0].territory}` : ""} — ${activePipelines[0].daysInStage}d`
      : null,
    calls:
      calls.length > 0
        ? calls.slice(0, 3).map((c) => `${c.date}: ${c.type ?? "call"} ${c.grade ? `(${c.grade})` : ""}`.trim())
        : "none",
    score: intel?.current_score ?? null,
    objections: objections.length > 0 ? objections : null,
    properties: propertyCount > 0 ? propertyCount : null,
    source: pv("opportunity_source"),
  };

  // --- 4. Claude Haiku narrative ---
  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: process.env.SCOUT_MODEL ?? "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: `${BRIEF_PROMPT}\n\n${JSON.stringify(context)}` }],
  });

  const narrative = message.content[0].type === "text" ? message.content[0].text : "";

  // --- 5. Deterministic next actions ---
  const tasks = (commitmentRes?.data ?? []) as any[];
  const nextActions = computeNextActions({ calls, pipelineStates: activePipelines, objections, tasks });

  return { narrative, nextActions };
}

interface NextActionInput {
  calls: { date: string | null; grade: string | null; suggestedAction: string | null }[];
  pipelineStates: { stage: string; daysInStage: number; territory: string | null }[];
  objections: string[];
  tasks: { commitment_text: string; due_date: string | null; status: string }[];
}

function computeNextActions(input: NextActionInput): { primary: string; secondary: string[] } {
  const actions: { priority: number; text: string }[] = [];
  const today = new Date();

  for (const task of input.tasks) {
    if (task.due_date && new Date(task.due_date) < today) {
      const daysOverdue = Math.floor((today.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
      actions.push({
        priority: 100 + daysOverdue,
        text: `Follow up: "${task.commitment_text}" (${daysOverdue}d overdue)`,
      });
    }
  }

  if (input.calls.length > 0 && input.calls[0].date) {
    const lastCallDate = new Date(input.calls[0].date);
    const daysSince = Math.floor((today.getTime() - lastCallDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 14) {
      actions.push({ priority: 80 + daysSince, text: `Schedule call — ${daysSince} days since last contact` });
    }
    if (input.calls[0].suggestedAction) {
      actions.push({ priority: 70, text: input.calls[0].suggestedAction });
    }
  } else {
    actions.push({ priority: 90, text: "Schedule introductory call — no calls on record" });
  }

  if (input.objections.length > 0) {
    actions.push({ priority: 60, text: `Address ${input.objections[0]} objection` });
  }

  for (const ps of input.pipelineStates) {
    if (ps.daysInStage > 30) {
      actions.push({ priority: 50, text: `${ps.stage} for ${ps.daysInStage} days — review pipeline velocity` });
    }
  }

  for (const task of input.tasks) {
    if (task.due_date && new Date(task.due_date) >= today) {
      actions.push({ priority: 30, text: `Upcoming: "${task.commitment_text}"` });
    }
  }

  actions.sort((a, b) => b.priority - a.priority);
  return {
    primary: actions[0]?.text ?? "No pressing actions",
    secondary: actions.slice(1, 3).map((a) => a.text),
  };
}

/**
 * Generate and store a journey brief.
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

  // Embed for RAG (fire-and-forget)
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
