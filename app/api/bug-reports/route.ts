export const dynamic = "force-dynamic";

/**
 * POST /api/bug-reports — Submit a bug report (any authenticated user)
 * GET  /api/bug-reports — List bug reports (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const body = await request.json();
  const { description, screenshotUrl, priority, pageUrl } = body;

  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  const validPriorities = ["small", "medium", "big", "emergency"];
  const safePriority = validPriorities.includes(priority) ? priority : "medium";

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bug_reports")
    .insert({
      user_id: user.id,
      user_name: user.fullName,
      description: description.trim(),
      screenshot_url: screenshotUrl || null,
      priority: safePriority,
      page_url: pageUrl || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, success: true });
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.from("bug_reports").select("*").order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
