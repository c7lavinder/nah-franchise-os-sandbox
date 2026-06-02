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
  const { data, error } = await supabase
    .from("ai_api_tokens")
    .select("id, user_id, token_prefix, scope, last_used_at, created_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tokens: data ?? [] });
}
