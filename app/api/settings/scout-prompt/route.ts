export const dynamic = "force-dynamic";

/**
 * GET/PUT /api/settings/scout-prompt — admin-only Scout prompt management.
 *
 * GET returns current prompt sections (from DB or defaults).
 * PUT updates a section in app_settings and clears the cache.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { clearPromptCache } from "@/lib/scout/prompt-loader";

const ALLOWED_KEYS = ["scout_identity", "scout_rules", "scout_profile_context"];

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("setting_key, setting_value, description")
    .in("setting_key", ALLOWED_KEYS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sections: data });
}

export async function PUT(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = (await request.json()) as { key: string; value: string | null };

  if (!ALLOWED_KEYS.includes(body.key)) {
    return NextResponse.json({ error: `Invalid key. Allowed: ${ALLOWED_KEYS.join(", ")}` }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ setting_value: body.value })
    .eq("setting_key", body.key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear cached prompt so the next Scout turn picks up the change
  clearPromptCache();

  return NextResponse.json({ success: true, key: body.key });
}
