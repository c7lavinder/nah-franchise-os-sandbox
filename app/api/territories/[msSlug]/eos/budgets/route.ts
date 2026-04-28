export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

/** POST — create a new budget line item */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();
  const body = await request.json() as { description?: string; amount?: number };

  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("eos_territory_budgets")
    .insert({
      territory_slug: msSlug,
      description: body.description.trim(),
      amount: body.amount ?? 0,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ budget: data });
}
