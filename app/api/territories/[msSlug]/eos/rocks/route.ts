export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

/** POST — create a new rock */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();
  const body = await request.json() as {
    rock_text?: string;
    quarter?: number;
    year?: number;
  };

  if (!body.rock_text?.trim()) {
    return NextResponse.json({ error: "rock_text is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("eos_territory_rocks")
    .insert({
      territory_slug: msSlug,
      rock_text: body.rock_text.trim(),
      quarter: body.quarter ?? null,
      year: body.year ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rock: data });
}
