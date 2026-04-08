export const dynamic = "force-dynamic";

/**
 * GET /api/settings/pipelines — list all pipelines with nested stages + sub-tasks
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();

  const { data: pipelines, error } = await supabase
    .from("pipelines")
    .select("id, slug, name, description, is_active, sort_order")
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = await Promise.all(
    (pipelines ?? []).map(async (p) => {
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, slug, name, sort_order, is_terminal, auto_advance_enabled")
        .eq("pipeline_id", p.id)
        .order("sort_order");

      const enrichedStages = await Promise.all(
        (stages ?? []).map(async (s) => {
          const { data: subTasks } = await supabase
            .from("pipeline_sub_tasks")
            .select("id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, default_logger_user_id, is_required")
            .eq("stage_id", s.id)
            .order("sort_order");
          return { ...s, subTasks: subTasks ?? [] };
        })
      );

      return { ...p, stages: enrichedStages };
    })
  );

  return NextResponse.json({ pipelines: enriched });
}
