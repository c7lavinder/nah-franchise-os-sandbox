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

  const supabase = createServerClient();

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order");

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

  return NextResponse.json({ pipelines: result });
}
