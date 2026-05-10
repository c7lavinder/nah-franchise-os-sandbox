/**
 * GET /api/zorakle/owner/:TerritorySlug — Zorakle profile for a territory owner
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const { TerritorySlug } = await params;
  const supabase = createServerClient();

  const { data } = await supabase
    .from("zorakle_profiles")
    .select("*")
    .eq("TerritorySlug", TerritorySlug)
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({ profile: data });
}
