export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/users — returns all active users for logger selection.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const supabase = createServerClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("is_active", true)
    .order("full_name");

  return NextResponse.json({
    users: (data ?? []).map((u) => ({ id: u.id, name: u.full_name, role: u.role })),
  });
}
