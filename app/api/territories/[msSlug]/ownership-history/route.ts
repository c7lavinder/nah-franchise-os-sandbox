/**
 * GET /api/territories/:msSlug/ownership-history
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("territory_ownership_history")
    .select("*")
    .eq("ms_slug", msSlug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data ?? [] });
}
