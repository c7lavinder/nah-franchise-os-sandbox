export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { bearerToken, logAiApiActivity, validateAiApiToken } from "@/lib/ai-api-tokens";

const ADMIN_ROLES = new Set(["admin", "operator", "leadership"]);

export async function GET(request: NextRequest) {
  const secret = bearerToken(request);
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") ?? "overview";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "25") || 25, 1), 100);

  if (!secret) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const token = await validateAiApiToken(secret);
  if (!token) {
    return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
  }

  const supabase = createServerClient();
  const canSeeAll = ADMIN_ROLES.has(token.user.role);

  await supabase.from("ai_api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.id);
  await logAiApiActivity({
    tokenId: token.id,
    userId: token.user_id,
    tokenPrefix: token.token_prefix,
    endpoint: url.pathname,
    resource,
    requestParams: { limit },
    userAgent: request.headers.get("user-agent"),
  });

  if (resource === "users") {
    let query = supabase
      .from("users")
      .select("id, email, full_name, role, ghl_user_id, is_active")
      .eq("is_active", true)
      .order("full_name")
      .limit(limit);
    if (!canSeeAll) query = query.eq("id", token.user_id);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ resource, scope: "AI_READ_ONLY", requestedBy: token.user, users: data ?? [] });
  }

  if (resource === "contacts") {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, ghl_contact_id, status, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ resource, scope: "AI_READ_ONLY", requestedBy: token.user, contacts: data ?? [] });
  }

  if (resource === "l10") {
    const [territoriesRes, stagesRes, activeRowsRes] = await Promise.all([
      supabase
        .from("territories")
        .select("TerritorySlug, Nickname, region, status")
        .eq("status", "active")
        .limit(limit),
      supabase.from("pipeline_stages").select("id, name, slug, sort_order").order("sort_order").limit(100),
      supabase
        .from("journey_pipeline_state")
        .select("id, current_stage_id, entered_current_stage_at, updated_at, assigned_user_id")
        .eq("is_active", true)
        .limit(1000),
    ]);
    if (territoriesRes.error) return NextResponse.json({ error: territoriesRes.error.message }, { status: 500 });
    if (stagesRes.error) return NextResponse.json({ error: stagesRes.error.message }, { status: 500 });
    if (activeRowsRes.error) return NextResponse.json({ error: activeRowsRes.error.message }, { status: 500 });

    const stageNameById = new Map((stagesRes.data ?? []).map((s) => [s.id, s.name]));
    const stageCounts = new Map<string, number>();
    for (const row of activeRowsRes.data ?? []) {
      const name = stageNameById.get(row.current_stage_id) ?? "Unknown";
      stageCounts.set(name, (stageCounts.get(name) ?? 0) + 1);
    }

    return NextResponse.json({
      resource,
      scope: "AI_READ_ONLY",
      requestedBy: token.user,
      territories: territoriesRes.data ?? [],
      stageCounts: Array.from(stageCounts.entries()).map(([stage, count]) => ({ stage, count })),
    });
  }

  const [usersRes, contactsRes, territoriesRes, activityRes] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("territories").select("TerritorySlug", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("ai_api_activity")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  return NextResponse.json({
    resource: "overview",
    scope: "AI_READ_ONLY",
    requestedBy: token.user,
    summary: {
      activeUsers: usersRes.count ?? 0,
      contacts: contactsRes.count ?? 0,
      activeTerritories: territoriesRes.count ?? 0,
      aiApiPullsLast24h: activityRes.count ?? 0,
    },
    availableResources: ["overview", "users", "contacts", "l10"],
  });
}
