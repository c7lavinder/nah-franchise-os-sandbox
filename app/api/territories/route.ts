export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const status = request.nextUrl.searchParams.get("status");
  const supabase = createServerClient();

  let query = supabase.from("territories").select("ms_slug, territory_name, status, region");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("territory_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ territories: data ?? [] });
}
