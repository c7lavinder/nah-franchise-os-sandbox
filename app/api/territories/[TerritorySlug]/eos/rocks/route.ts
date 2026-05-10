export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/** POST — create a new rock */
export async function POST(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const { TerritorySlug } = await params;
  const supabase = createServerClient();
  const body = (await request.json()) as {
    Rock?: string;
    quarter?: number;
    year?: number;
  };

  if (!body.Rock?.trim()) {
    return NextResponse.json({ error: "Rock is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("eos_territory_rocks")
    .insert({
      TerritorySlug: TerritorySlug,
      Rock: body.Rock.trim(),
      quarter: body.quarter ?? null,
      year: body.year ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rock: data });
}
