export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: rubric } = await supabase
    .from("rubrics")
    .select("id, name, description, is_active")
    .eq("call_type_id", id)
    .eq("is_active", true)
    .single();

  if (!rubric) return NextResponse.json({ rubric: null, criteria: [] });

  const { data: criteria } = await supabase
    .from("rubric_criteria")
    .select("id, name, description, weight, sort_order")
    .eq("rubric_id", rubric.id)
    .order("sort_order");

  return NextResponse.json({ rubric, criteria: criteria ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as { name?: string; description?: string; userId?: string };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const supabase = createServerClient();
  const { data: rubric } = await supabase
    .from("rubrics")
    .select("id")
    .eq("call_type_id", id)
    .eq("is_active", true)
    .single();

  if (!rubric) return NextResponse.json({ error: "No active rubric" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;

  const { error } = await supabase.from("rubrics").update(updates).eq("id", rubric.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
