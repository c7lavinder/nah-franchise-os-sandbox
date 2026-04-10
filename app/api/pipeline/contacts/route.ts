export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/contacts
 *
 * Returns active pipeline contacts from Supabase for the All Leads list.
 * Fetches ALL matching rows (paginating through Supabase's 1000-row limit).
 *
 * Query params:
 *   stage_id — filter to a specific stage (optional)
 *   pipeline — "sales" | "followup" | "all" (default "all")
 *   sort — "urgency" | "name" | "recent" (default "recent")
 *   q — search term (server-side search on contacts table)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000; // Supabase PostgREST max per request

const SELECT_FIELDS = `
  id,
  contact_id,
  pipeline_id,
  current_stage_id,
  current_sub_task_id,
  current_sub_task_started_at,
  entered_current_stage_at,
  entered_pipeline_at,
  assigned_user_id,
  is_active,
  contacts (
    id,
    first_name,
    last_name,
    email,
    phone,
    opportunity_source,
    city,
    state
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

    // Server-side search: find matching contact IDs first
    let matchingContactIds: string[] | null = null;
    if (query) {
      const { data: matchedContacts } = await supabase
        .from("contacts")
        .select("id")
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5000);

      matchingContactIds = (matchedContacts ?? []).map((c) => c.id);
      if (matchingContactIds.length === 0) {
        return NextResponse.json({ contacts: [], total: 0, totalCount: 0 });
      }
    }

    // Get total count
    let totalCountQuery = supabase
      .from("contact_pipeline_state")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    if (matchingContactIds) totalCountQuery = totalCountQuery.in("contact_id", matchingContactIds);
    if (stageId) totalCountQuery = totalCountQuery.eq("current_stage_id", stageId);
    if (pipelineSlug === "sales") totalCountQuery = totalCountQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000001");
    else if (pipelineSlug === "followup") totalCountQuery = totalCountQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000002");
    const { count: totalCount } = await totalCountQuery;

    // Fetch ALL rows by paginating through Supabase's 1000-row limit
    const allRows: Record<string, unknown>[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let dbQuery = supabase
        .from("contact_pipeline_state")
        .select(SELECT_FIELDS)
        .eq("is_active", true);

      if (matchingContactIds) dbQuery = dbQuery.in("contact_id", matchingContactIds);
      if (stageId) dbQuery = dbQuery.eq("current_stage_id", stageId);
      if (pipelineSlug === "sales") dbQuery = dbQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000001");
      else if (pipelineSlug === "followup") dbQuery = dbQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000002");

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

      // Safety cap at 10k to prevent runaway
      if (allRows.length >= 10000) break;
    }

    // Post-process: compute urgency
    const now = Date.now();

    type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; opportunity_source: string | null; city: string | null; state: string | null };
    type StageRow = { id: string; name: string; slug: string };
    type PipelineRow = { id: string; name: string; slug: string; sort_order: number };

    // Deduplicate by contact_id — keep the row from the highest-sort_order pipeline
    // (furthest lifecycle stage: sales=1 → onboarding=2 → runway=3 → territories=4 → followup=5)
    if (!stageId) {
      const bestByContact = new Map<string, Record<string, unknown>>();
      for (const row of allRows) {
        const cid = row.contact_id as string;
        const rawPipeline = row.pipelines;
        const pipeline = (Array.isArray(rawPipeline) ? rawPipeline[0] : rawPipeline) as PipelineRow | null;
        const sortOrder = pipeline?.sort_order ?? 0;

        const existing = bestByContact.get(cid);
        if (!existing) {
          bestByContact.set(cid, row);
        } else {
          const existingPipeline = existing.pipelines;
          const ep = (Array.isArray(existingPipeline) ? existingPipeline[0] : existingPipeline) as PipelineRow | null;
          if (sortOrder > (ep?.sort_order ?? 0)) {
            bestByContact.set(cid, row);
          }
        }
      }
      allRows.length = 0;
      allRows.push(...bestByContact.values());
    }

    const contacts = allRows.map((row: Record<string, unknown>) => {
      // Supabase joins can return object or array — normalize
      const rawContact = row.contacts;
      const contact = (Array.isArray(rawContact) ? rawContact[0] : rawContact) as ContactRow | null;
      const rawStage = row.pipeline_stages;
      const stage = (Array.isArray(rawStage) ? rawStage[0] : rawStage) as StageRow | null;
      const rawPipeline = row.pipelines;
      const pipeline = (Array.isArray(rawPipeline) ? rawPipeline[0] : rawPipeline) as PipelineRow | null;

      const name = [contact?.first_name?.trim(), contact?.last_name?.trim()].filter(Boolean).join(" ") || (contact?.email ?? contact?.phone ?? "Unknown");

      const subTaskStarted = row.current_sub_task_started_at
        ? new Date(row.current_sub_task_started_at as string).getTime()
        : row.entered_current_stage_at
          ? new Date(row.entered_current_stage_at as string).getTime()
          : now;
      const daysSinceSubTask = Math.floor((now - subTaskStarted) / (1000 * 60 * 60 * 24));

      let urgency: "fresh" | "at_risk" | "losing";
      let urgencyScore: number;
      if (daysSinceSubTask >= 10) {
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
        contactId: row.contact_id as string,
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

    // Sort
    if (sort === "urgency") {
      contacts.sort((a, b) => b.urgencyScore - a.urgencyScore || b.daysSinceSubTask - a.daysSinceSubTask);
    } else if (sort === "name") {
      contacts.sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({ contacts, total: contacts.length, totalCount: totalCount ?? contacts.length });
  } catch (err) {
    console.error("Pipeline contacts error:", err);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}
