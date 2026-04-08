export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/users — returns all active users for logger selection.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
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
