export const dynamic = "force-dynamic";

/**
 * GET /api/suggestions?contact_id=X or ?territory_ms_slug=X
 * Returns pending data_update_suggestions for the entity.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const contactId = request.nextUrl.searchParams.get("contact_id");
  const territorySlug = request.nextUrl.searchParams.get("territory_ms_slug");

  if (!contactId && !territorySlug) {
    return NextResponse.json({ error: "contact_id or territory_ms_slug required" }, { status: 400 });
  }

  const supabase = createServerClient();
  let query = supabase
    .from("data_update_suggestions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (contactId) query = query.eq("contact_id", contactId);
  else if (territorySlug) query = query.eq("territory_ms_slug", territorySlug);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ suggestions: data ?? [], count: data?.length ?? 0 });
}
