export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-check";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rubricId } = await params;
  const body = await request.json() as { name: string; description?: string; weight?: number; userId?: string };
  const admin = await requireAdmin(request.headers.get("Authorization"), body.userId);
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("rubric_criteria")
    .select("sort_order")
    .eq("rubric_id", rubricId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("rubric_criteria")
    .insert({
      rubric_id: rubricId,
      name: body.name,
      description: body.description ?? null,
      weight: body.weight ?? 1.0,
      sort_order: nextOrder,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, success: true });
}
