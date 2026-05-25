export const dynamic = "force-dynamic";

/**
 * GET /api/pipelines/stages
 *
 * Returns all pipelines with their stages for dropdowns.
 * Response: { pipelines: [{ id, name, slug, stages: [{ id, name, slug, sortOrder }] }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { searchParams } = new URL(request.url);
  const includeSubTasks = searchParams.get("include_sub_tasks") === "true";

  const supabase = createServerClient();

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order");

  // Pre-fetch all sub-tasks in one query if requested
  let subTasksByStage = new Map<
    string,
    { id: string; slug: string; name: string; sort_order: number; stage_id: string }[]
  >();
  if (includeSubTasks) {
    const { data: allSubTasks } = await supabase
      .from("pipeline_sub_tasks")
      .select("id, slug, name, sort_order, stage_id")
      .order("sort_order");
    for (const st of allSubTasks ?? []) {
      const arr = subTasksByStage.get(st.stage_id) ?? [];
      arr.push(st);
      subTasksByStage.set(st.stage_id, arr);
    }
  }

  const result = [];
  for (const pipeline of pipelines ?? []) {
    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, name, slug, sort_order")
      .eq("pipeline_id", pipeline.id)
      .order("sort_order");

    result.push({
      id: pipeline.id,
      name: pipeline.name,
      slug: pipeline.slug,
      stages: (stages ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        sortOrder: s.sort_order,
      })),
    });
  }

  // Return sub-tasks as a flat array (matches what the pipeline page expects)
  const allSubTasks = includeSubTasks ? [...subTasksByStage.values()].flat() : undefined;

  return NextResponse.json({
    pipelines: result,
    ...(allSubTasks ? { subTasks: allSubTasks } : {}),
  });
}
