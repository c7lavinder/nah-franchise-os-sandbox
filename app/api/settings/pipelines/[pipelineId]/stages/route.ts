export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-check";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const { pipelineId } = await params;
  const body = await request.json() as { name: string; slug?: string; userId?: string };
  const admin = await requireAdmin(request.headers.get("Authorization"), body.userId);
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const supabase = createServerClient();

  // Get next sort_order
  const { data: existing } = await supabase
    .from("pipeline_stages")
    .select("sort_order")
    .eq("pipeline_id", pipelineId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const slug = body.slug ?? body.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({ pipeline_id: pipelineId, name: body.name, slug, sort_order: nextOrder })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, success: true });
}
