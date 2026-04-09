export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-check";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as {
    name?: string; description?: string; weight?: number;
    positive_examples?: string[]; negative_examples?: string[];
    example_phrases_positive?: string[]; example_phrases_negative?: string[];
    kb_document_ids?: string[]; userId?: string;
  };
  const admin = await requireAdmin(request.headers.get("Authorization"), body.userId);
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.weight !== undefined) updates.weight = body.weight;
  if (body.positive_examples !== undefined) updates.positive_examples = body.positive_examples;
  if (body.negative_examples !== undefined) updates.negative_examples = body.negative_examples;
  if (body.example_phrases_positive !== undefined) updates.example_phrases_positive = body.example_phrases_positive;
  if (body.example_phrases_negative !== undefined) updates.example_phrases_negative = body.example_phrases_negative;
  if (body.kb_document_ids !== undefined) updates.kb_document_ids = body.kb_document_ids;

  const { error } = await supabase.from("rubric_criteria").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { userId?: string };
  const admin = await requireAdmin(request.headers.get("Authorization"), body.userId);
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const supabase = createServerClient();
  const { error } = await supabase.from("rubric_criteria").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
