export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rubricId } = await params;
  const body = await request.json() as { name: string; description?: string; weight?: number; userId?: string };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

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
