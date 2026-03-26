export const dynamic = "force-dynamic";

/**
 * GET /api/intelligence/llm-logs — query Claude API call logs for debugging.
 *
 * Query params:
 *   userId   — filter by user ID
 *   sessionId — (reserved for future use)
 *   limit    — max rows returned (default 50, max 200)
 *   offset   — pagination offset (default 0)
 *
 * Returns rows from llm_call_logs ordered by created_at desc.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
      200
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") ?? "0", 10) || 0,
      0
    );

    const supabase = createServerClient();

    let query = supabase
      .from("llm_call_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: logs ?? [], limit, offset });
  } catch (err) {
    console.error("GET llm-logs error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
