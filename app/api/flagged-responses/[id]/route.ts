export const dynamic = "force-dynamic";

/**
 * PATCH /api/flagged-responses/[id] - Update Scout feedback status (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  const validStatuses = ["needs_review", "working_on_it", "fixed", "skipped"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, string | null> = {
    status,
    reviewed_at: status === "needs_review" ? null : now,
  };

  if (status === "fixed" || status === "skipped") {
    updates.resolved_at = now;
  } else {
    updates.resolved_at = null;
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("flagged_responses").update(updates).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
