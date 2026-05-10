export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/** PUT — update a budget line item */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ TerritorySlug: string; budgetId: string }> }
) {
  const { budgetId } = await params;
  const supabase = createServerClient();
  const body = (await request.json()) as { description?: string; amount?: number };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.description !== undefined) updates.description = body.description;
  if (body.amount !== undefined) updates.amount = body.amount;

  const { error } = await supabase.from("eos_territory_budgets").update(updates).eq("id", budgetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE — remove a budget line item */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ TerritorySlug: string; budgetId: string }> }
) {
  const { budgetId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase.from("eos_territory_budgets").delete().eq("id", budgetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
