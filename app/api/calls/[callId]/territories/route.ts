export const dynamic = "force-dynamic";

/**
 * GET /api/calls/[callId]/territories
 *
 * Returns every territory attached to a call, with is_primary flag. Used by
 * the mapping modal to render the multi-territory checkbox list.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("call_territories")
    .select("TerritorySlug, is_primary")
    .eq("call_id", callId)
    .order("is_primary", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ territories: data ?? [] });
}
