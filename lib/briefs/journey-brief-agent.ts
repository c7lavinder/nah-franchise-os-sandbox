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

// Pipeline stage context so Claude (and next-action logic) understands what each stage means
const STAGE_CONTEXT: Record<string, string> = {
  // Sales pipeline
  engagement: "Initial outreach and intro call — earliest contact stage",
  qualification: "NDA signed, Matt intro call, Zorakle assessment — vetting fit",
  discovery: "Deep dive: Sam call, PFS review, background check, Mark call — serious candidate",
  compliance: "FDD sent, review call, territory selection, FA info gathering — near-final",
  awarding:
    "Final stage before franchise award: Matt final call, award letter, FA signing, franchise fee payment — this person is being awarded a franchise",
  closed: "Franchise awarded — transitioning to onboarding",
  // Onboarding pipeline
  setup: "New franchisee onboarding setup",
  training: "Franchisee in training",
  onboarded: "Franchisee fully onboarded and operational",
  // Territory pipeline
  active: "Active franchisee with awarded territory — buying and flipping properties",
  running: "Franchisee actively running their territory operations",
  // Runway pipeline
  "first-offers": "Active franchisee making first property offers",
  "first-acquisition": "Franchisee acquiring first property",
  "inventory-building": "Franchisee building property inventory",
  "runway-complete": "Franchisee graduated to independent operations",
  // Follow-up pipeline
  followup: "Dropped from sales — specific reason to resume later",
  nurture: "Long-term cold storage — no active engagement",
  reengaged: "Re-engaged and ready to re-enter sales process",
};

const BRIEF_PROMPT = `You are Scout, the AI franchise sales coach for New Again Houses.

OUTPUT FORMAT — respond with exactly this JSON (no markdown, no code fences):
{"narrative":"...","nextStep":"..."}

NARRATIVE (3-4 sentences):
Be concrete — use names, dates, numbers. Do not speculate.
Keep it conversational but professional, like a quick verbal briefing before a meeting.
Focus on: who they are, where they stand, key signals, and any momentum or risk.

NEXT STEP (1 sentence, commanding):
Give exactly ONE specific, urgent next action. Use the candidate's first name and the team member they need to talk to. Be direct and demanding — this is a marching order, not a suggestion.
Good: "Get Kevin on a call with Sam this week to start deep discovery."
Good: "Send the FDD to Lisa today — she's been in Compliance 5 days with no doc."
Bad: "Complete Sam call, PFS review, and background check" (too many items, too passive)
Bad: "Schedule introductory call" (too vague, no name)

IMPORTANT: The "stage" field tells you exactly where they are in the sales process.
Later stages (Compliance, Awarding, Closed) mean this person has been thoroughly vetted
and is close to or already a franchisee. Do NOT treat missing call data as "we haven't
connected" — it likely means call data hasn't been migrated yet. Interpret through the
lens of what the stage implies.

The "stageContext" field explains what each stage means in this franchise sales process.`;

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
         pipelines(name, slug), pipeline_stages(name, slug)`
      )
      .eq("journey_id", journeyId),
  ]);

  const journey = journeyRes.data as JourneyRow | null;
  if (!journey) return null;

  const primaryContactId = journey.primary_contact_id;
  let slugs = ((pipelineRes.data ?? []) as any[]).map((r) => r.TerritorySlug).filter(Boolean) as string[];

  // Get territory ownership (also used for actual start date)
  const { data: ownershipRows } = await supabase
    .from("territory_owners")
    .select(`"TerritorySlug", start_date`)
    .eq("contact_id", primaryContactId)
    .is("end_date", null);

  // Fallback: if JPS has no territory slugs, use territory_owners
  if (slugs.length === 0) {
    slugs = ((ownershipRows ?? []) as any[]).map((r) => r.TerritorySlug).filter(Boolean) as string[];
  }

  // Use earliest territory ownership date as the real start (not journey.created_at which may be a backfill date)
  const ownerStartDates = ((ownershipRows ?? []) as any[])
    .map((r) => r.start_date)
    .filter(Boolean)
    .sort();
  const actualStartDate = ownerStartDates.length > 0 ? ownerStartDates[0] : journey.created_at;

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
    // Count purchased properties (actual inventory), not total leads
    uniqueSlugs.length > 0
      ? (async () => {
          const { data: propIds } = await supabase
            .from("ms_properties")
            .select(`"PropertyId"`)
            .in("TerritorySlug", uniqueSlugs);
          if (!propIds || propIds.length === 0) return { count: 0 };
          const ids = propIds.map((r: any) => r.PropertyId);
          const { count } = await supabase
            .from("ms_property_inventory")
            .select(`"PropertyId"`, { count: "exact", head: true })
            .not("Inv_PurchaseDate", "is", null)
            .in("PropertyId", ids);
          return { count: count ?? 0 };
        })()
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
      const stageSlug =
        (Array.isArray(ps.pipeline_stages) ? ps.pipeline_stages[0]?.slug : ps.pipeline_stages?.slug) ?? "";
      const pipelineSlug = (Array.isArray(ps.pipelines) ? ps.pipelines[0]?.slug : ps.pipelines?.slug) ?? "";
      return {
        pipeline: (Array.isArray(ps.pipelines) ? ps.pipelines[0]?.name : ps.pipelines?.name) ?? "Unknown",
        pipelineSlug,
        stage:
          (Array.isArray(ps.pipeline_stages) ? ps.pipeline_stages[0]?.name : ps.pipeline_stages?.name) ?? "Unknown",
        stageSlug,
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
  const currentStageSlug = activePipelines[0]?.stageSlug ?? "";
  const stageContextText = STAGE_CONTEXT[currentStageSlug] ?? null;

  // Extract primary contact first name for personalized next step
  const primaryMember = members.find((m) => m.role === "primary") ?? members[0];
  const contactFirstName = primaryMember?.name.split(" ")[0] ?? "this candidate";

  const context: Record<string, unknown> = {
    journey: { name: journey.name, started: new Date(actualStartDate).toLocaleDateString() },
    contactFirstName,
    members: members.map((m) => `${m.name} (${m.role}${m.city ? `, ${m.city} ${m.state}` : ""})`),
    stage: activePipelines[0]
      ? `${activePipelines[0].stage}${activePipelines[0].territory ? ` / ${activePipelines[0].territory}` : ""} — ${activePipelines[0].daysInStage}d`
      : null,
    stageContext: stageContextText,
    pipeline: activePipelines[0]?.pipeline ?? null,
    calls:
      calls.length > 0
        ? calls.slice(0, 3).map((c) => `${c.date}: ${c.type ?? "call"} ${c.grade ? `(${c.grade})` : ""}`.trim())
        : "none logged (may not be migrated yet)",
    score: intel?.current_score ?? null,
    objections: objections.length > 0 ? objections : null,
    propertiesPurchased: propertyCount > 0 ? propertyCount : null,
    source: pv("opportunity_source"),
    pendingTasks:
      (commitmentRes?.data ?? []).length > 0
        ? (commitmentRes.data as any[]).slice(0, 3).map((t: any) => {
            const overdue = t.due_date && new Date(t.due_date) < new Date();
            return `${t.commitment_text}${t.due_date ? ` (due ${new Date(t.due_date).toLocaleDateString()}${overdue ? " — OVERDUE" : ""})` : ""}`;
          })
        : null,
  };

  // --- 4. Claude Haiku narrative + next step ---
  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: process.env.SCOUT_MODEL ?? "claude-haiku-4-5-20251001",
    max_tokens: 350,
    messages: [{ role: "user", content: `${BRIEF_PROMPT}\n\n${JSON.stringify(context)}` }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  let narrative = raw;
  let aiNextStep: string | null = null;

  try {
    // Strip markdown code fences if Claude wrapped the JSON
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    narrative = parsed.narrative ?? raw;
    aiNextStep = parsed.nextStep ?? null;
  } catch {
    // If Claude didn't return valid JSON, use the raw text as narrative
  }

  // --- 5. Next actions: AI primary + deterministic secondary ---
  const tasks = (commitmentRes?.data ?? []) as any[];
  const deterministic = computeNextActions({ calls, pipelineStates: activePipelines, objections, tasks });

  const nextActions = {
    primary: aiNextStep || deterministic.primary,
    secondary: deterministic.secondary,
  };

  return { narrative, nextActions };
}

// Stage-specific next actions when no other signals exist
const STAGE_DEFAULT_ACTIONS: Record<string, string> = {
  engagement: "Complete outreach and schedule intro call",
  qualification: "Ensure NDA is signed and Matt call is scheduled",
  discovery: "Complete Sam call, PFS review, and background check",
  compliance: "Send FDD and schedule review call",
  awarding: "Complete Matt final call and send franchise award letter",
  closed: "Transition to onboarding — schedule setup kickoff",
  setup: "Complete onboarding setup checklist",
  training: "Continue franchisee training program",
  "first-offers": "Optimize marketing and get first 10 offers sent",
  "first-acquisition": "Close first property and start rehab",
  "inventory-building": "Build to 2+ properties in inventory",
  active: "Review territory performance and property pipeline",
  running: "Monitor deal flow and operational metrics",
  onboarded: "Check in on territory ramp-up progress",
  followup: "Re-engage when timing is right",
  nurture: "Monitor for re-engagement signals",
  reengaged: "Move back into sales pipeline",
};

// Late-stage slugs where "no calls on record" is likely a data gap, not reality
const LATE_STAGES = new Set([
  "discovery",
  "compliance",
  "awarding",
  "closed",
  "setup",
  "training",
  "onboarded",
  "running",
  "first-offers",
  "first-acquisition",
  "inventory-building",
  "runway-complete",
  "active",
]);

// Stages where sitting for a long time is expected — don't warn about velocity
const NO_VELOCITY_WARNING = new Set([
  "closed",
  "runway-complete",
  "active",
  "running",
  "onboarded",
  "nurture",
  "inventory-building",
  "first-offers",
  "first-acquisition",
  "setup",
  "training",
]);

interface NextActionInput {
  calls: { date: string | null; grade: string | null; suggestedAction: string | null }[];
  pipelineStates: { stage: string; stageSlug: string; daysInStage: number; territory: string | null }[];
  objections: string[];
  tasks: { commitment_text: string; due_date: string | null; status: string }[];
}

function computeNextActions(input: NextActionInput): { primary: string; secondary: string[] } {
  const actions: { priority: number; text: string }[] = [];
  const today = new Date();
  const currentSlug = input.pipelineStates[0]?.stageSlug ?? "";
  const isLateStage = LATE_STAGES.has(currentSlug);

  // Overdue tasks
  for (const task of input.tasks) {
    if (task.due_date && new Date(task.due_date) < today) {
      const daysOverdue = Math.floor((today.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
      actions.push({
        priority: 100 + daysOverdue,
        text: `Follow up: "${task.commitment_text}" (${daysOverdue}d overdue)`,
      });
    }
  }

  // Call recency — but only for early stages where "no calls" is meaningful
  if (input.calls.length > 0 && input.calls[0].date) {
    const lastCallDate = new Date(input.calls[0].date);
    const daysSince = Math.floor((today.getTime() - lastCallDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 14) {
      actions.push({ priority: 80 + daysSince, text: `Schedule call — ${daysSince} days since last contact` });
    }
    // Note: call-level suggestedAction (from grading) is intentionally NOT surfaced
    // here — those are call-specific coaching tips, not journey-level actions.
  } else if (!isLateStage) {
    // Only suggest intro call for early stages where it makes sense
    actions.push({ priority: 90, text: "Schedule introductory call — no calls on record" });
  }

  // Objections
  if (input.objections.length > 0) {
    actions.push({ priority: 60, text: `Address ${input.objections[0]} objection` });
  }

  // Stage velocity — only for active sales stages where stalling is a concern
  for (const ps of input.pipelineStates) {
    if (ps.daysInStage > 30 && !NO_VELOCITY_WARNING.has(ps.stageSlug)) {
      actions.push({ priority: 50, text: `${ps.stage} for ${ps.daysInStage} days — review pipeline velocity` });
    }
  }

  // Upcoming tasks
  for (const task of input.tasks) {
    if (task.due_date && new Date(task.due_date) >= today) {
      actions.push({ priority: 30, text: `Upcoming: "${task.commitment_text}"` });
    }
  }

  // Stage-specific default action (fallback when nothing else applies)
  const stageDefault = STAGE_DEFAULT_ACTIONS[currentSlug];
  if (stageDefault) {
    actions.push({ priority: 20, text: stageDefault });
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
