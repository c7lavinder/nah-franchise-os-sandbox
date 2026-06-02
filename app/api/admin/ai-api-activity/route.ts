export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") ?? "100") || 100, 1), 250);
  const { data, error } = await supabase
    .from("ai_api_activity")
    .select(
      "id, token_prefix, endpoint, resource, method, status_code, request_params, user_agent, created_at, user:users(id, email, full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data ?? [] });
}
