export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/contacts
 *
 * Phase 3 cutover: pipeline rows now come from journey_pipeline_state +
 * journey_contacts (primary member) instead of contact_pipeline_state.
 * Response shape is unchanged so the existing PipelineLeadList UI renders
 * identically. journeyId and territoryMsSlug are added non-breaking so the
 * lead-card link target can evolve later without another route rewrite.
 *
 * Query params:
 *   stage_id — filter to a specific stage (optional)
 *   pipeline — "sales" | "followup" | "all" (default "all")
 *   sort — "urgency" | "name" | "recent" (default "recent")
 *   q — search term (server-side search on contacts table)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;

const SELECT_FIELDS = `
  id,
  journey_id,
  territory_ms_slug,
  pipeline_id,
  current_stage_id,
  current_sub_task_id,
  current_sub_task_started_at,
  entered_current_stage_at,
  entered_pipeline_at,
  assigned_user_id,
  is_active,
  journeys!inner (
    id,
    name,
    primary_contact_id,
    contacts!journeys_primary_contact_id_fkey (
      id,
      first_name,
      last_name,
      email,
      phone,
      opportunity_source,
      city,
      state
    )
  ),
  pipeline_stages (
    id,
    name,
    slug
  ),
  pipelines (
    id,
    name,
    slug,
    sort_order
  )
`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stageId = searchParams.get("stage_id");
    const pipelineSlug = searchParams.get("pipeline") ?? "all";
    const sort = searchParams.get("sort") ?? "recent";
    const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

    const supabase = createServerClient();

    // Server-side search resolves to a set of primary_contact_ids. We then
    // restrict to journeys whose primary member matches.
    let matchingContactIds: string[] | null = null;
    if (query) {
      const words = query.split(/\s+/).filter(Boolean);

      if (words.length >= 2) {
        const [first, ...rest] = words;
        const last = rest.join(" ");
        const { data: nameMatch } = await supabase
          .from("contacts")
          .select("id")
          .ilike("first_name", `%${first}%`)
          .ilike("last_name", `%${last}%`)
          .limit(5000);

        const { data: fallback } = await supabase
          .from("contacts")
          .select("id")
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(5000);

        const idSet = new Set([
          ...(nameMatch ?? []).map((c) => c.id),
          ...(fallback ?? []).map((c) => c.id),
        ]);
        matchingContactIds = [...idSet];
      } else {
        const { data: matchedContacts } = await supabase
          .from("contacts")
          .select("id")
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(5000);
        matchingContactIds = (matchedContacts ?? []).map((c) => c.id);
      }

      if (matchingContactIds.length === 0) {
        return NextResponse.json({ contacts: [], total: 0, totalCount: 0 });
      }
    }

    // Fetch every matching jps row, paginated. Total count is derived post-
    // dedupe since the unfiltered view collapses journeys across pipelines.
    const allRows: Record<string, unknown>[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let dbQuery = supabase
        .from("journey_pipeline_state")
        .select(SELECT_FIELDS)
        .eq("is_active", true);

      if (stageId) dbQuery = dbQuery.eq("current_stage_id", stageId);
      if (pipelineSlug === "sales") dbQuery = dbQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000001");
      else if (pipelineSlug === "followup") dbQuery = dbQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000002");
      if (matchingContactIds) dbQuery = dbQuery.in("journeys.primary_contact_id", matchingContactIds);

      if (sort === "recent") {
        dbQuery = dbQuery.order("entered_current_stage_at", { ascending: false });
      } else {
        dbQuery = dbQuery.order("current_sub_task_started_at", { ascending: true, nullsFirst: false });
      }

      dbQuery = dbQuery.range(offset, offset + PAGE_SIZE - 1);

      const { data: rows, error } = await dbQuery;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      allRows.push(...(rows ?? []));
      hasMore = (rows?.length ?? 0) === PAGE_SIZE;
      offset += PAGE_SIZE;

      if (allRows.length >= 10000) break;
    }

    const now = Date.now();

    type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; opportunity_source: string | null; city: string | null; state: string | null };
    type JourneyRow = { id: string; name: string; primary_contact_id: string; contacts: ContactRow | ContactRow[] | null };
    type StageRow = { id: string; name: string; slug: string };
    type PipelineRow = { id: string; name: string; slug: string; sort_order: number };

    // Unfiltered view: one card per journey, preferring the highest-sort_order
    // pipeline (lifecycle furthest along). Matches the pre-cutover behavior.
    if (!stageId) {
      const bestByJourney = new Map<string, Record<string, unknown>>();
      for (const row of allRows) {
        const journeyIdKey = row.journey_id as string;
        const rawPipeline = row.pipelines;
        const pipeline = (Array.isArray(rawPipeline) ? rawPipeline[0] : rawPipeline) as PipelineRow | null;
        const sortOrder = pipeline?.sort_order ?? 0;

        const existing = bestByJourney.get(journeyIdKey);
        if (!existing) {
          bestByJourney.set(journeyIdKey, row);
        } else {
          const existingPipeline = existing.pipelines;
          const ep = (Array.isArray(existingPipeline) ? existingPipeline[0] : existingPipeline) as PipelineRow | null;
          if (sortOrder > (ep?.sort_order ?? 0)) {
            bestByJourney.set(journeyIdKey, row);
          }
        }
      }
      allRows.length = 0;
      allRows.push(...bestByJourney.values());
    }

    const contacts = allRows.map((row: Record<string, unknown>) => {
      const rawJourney = row.journeys;
      const journey = (Array.isArray(rawJourney) ? rawJourney[0] : rawJourney) as JourneyRow | null;
      const rawContact = journey?.contacts;
      const contact = (Array.isArray(rawContact) ? rawContact[0] : rawContact) as ContactRow | null;
      const rawStage = row.pipeline_stages;
      const stage = (Array.isArray(rawStage) ? rawStage[0] : rawStage) as StageRow | null;
      const rawPipeline = row.pipelines;
      const pipeline = (Array.isArray(rawPipeline) ? rawPipeline[0] : rawPipeline) as PipelineRow | null;

      const name = journey?.name
        ?? [contact?.first_name?.trim(), contact?.last_name?.trim()].filter(Boolean).join(" ")
        ?? contact?.email
        ?? contact?.phone
        ?? "Unknown";

      const subTaskStarted = row.current_sub_task_started_at
        ? new Date(row.current_sub_task_started_at as string).getTime()
        : row.entered_current_stage_at
          ? new Date(row.entered_current_stage_at as string).getTime()
          : now;
      const daysSinceSubTask = Math.floor((now - subTaskStarted) / (1000 * 60 * 60 * 24));

      const isTerminal = stage?.slug === "closed" || stage?.slug === "onboarded"
        || stage?.slug === "runway-complete" || stage?.slug === "running"
        || (stage as StageRow & { is_terminal?: boolean })?.is_terminal === true;

      let urgency: "fresh" | "at_risk" | "losing" | "won";
      let urgencyScore: number;
      if (isTerminal) {
        urgency = "won";
        urgencyScore = 0;
      } else if (daysSinceSubTask >= 10) {
        urgency = "losing";
        urgencyScore = 3;
      } else if (daysSinceSubTask >= 5) {
        urgency = "at_risk";
        urgencyScore = 2;
      } else {
        urgency = "fresh";
        urgencyScore = 1;
      }

      return {
        stateId: row.id as string,
        contactId: (contact?.id ?? journey?.primary_contact_id ?? "") as string,
        journeyId: row.journey_id as string,
        territoryMsSlug: (row.territory_ms_slug as string | null) ?? null,
        name,
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        source: contact?.opportunity_source ?? null,
        city: contact?.city ?? null,
        state: contact?.state ?? null,
        stageName: stage?.name ?? "Unknown",
        stageSlug: stage?.slug ?? "",
        stageId: row.current_stage_id as string,
        pipelineName: pipeline?.name ?? "Unknown",
        pipelineSlug: pipeline?.slug ?? "",
        daysSinceSubTask,
        urgency,
        urgencyScore,
        enteredStageAt: row.entered_current_stage_at as string | null,
      };
    });

    if (sort === "urgency") {
      contacts.sort((a, b) => b.urgencyScore - a.urgencyScore || b.daysSinceSubTask - a.daysSinceSubTask);
    } else if (sort === "name") {
      contacts.sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({ contacts, total: contacts.length, totalCount: contacts.length });
  } catch (err) {
    console.error("Pipeline contacts error:", err);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}
