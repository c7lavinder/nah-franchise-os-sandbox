export const dynamic = "force-dynamic";

/**
 * GET /api/team/members
 *
 * Returns active team members for dropdowns (assigned-to, etc.)
 * Response: { members: [{ id, fullName, ghlUserId }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, ghl_user_id")
    .not("ghl_user_id", "is", null)
    .order("full_name");

  const members = (data ?? []).map((u) => ({
    id: u.id,
    fullName: u.full_name,
    ghlUserId: u.ghl_user_id,
  }));

  return NextResponse.json({ members });
}
