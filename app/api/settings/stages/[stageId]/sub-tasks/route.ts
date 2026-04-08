export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-check";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const { stageId } = await params;
  const body = await request.json() as {
    name: string; slug?: string; state_type?: string;
    first_state_label?: string; second_state_label?: string;
    is_required?: boolean; userId?: string;
  };
  const admin = await requireAdmin(request.headers.get("Authorization"), body.userId);
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("pipeline_sub_tasks")
    .select("sort_order")
    .eq("stage_id", stageId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const slug = body.slug ?? body.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const { data, error } = await supabase
    .from("pipeline_sub_tasks")
    .insert({
      stage_id: stageId,
      name: body.name,
      slug,
      sort_order: nextOrder,
      state_type: body.state_type ?? "two_state",
      first_state_label: body.first_state_label ?? null,
      second_state_label: body.second_state_label ?? null,
      is_required: body.is_required ?? true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, success: true });
}
