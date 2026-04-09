/**
 * GET /api/zorakle/owner/:msSlug — Zorakle profile for a territory owner
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();

  const { data } = await supabase
    .from("zorakle_profiles")
    .select("*")
    .eq("ms_slug", msSlug)
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({ profile: data });
}
