export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { bearerToken, logAiApiActivity, validateAiApiToken } from "@/lib/ai-api-tokens";
import { executeTool } from "@/lib/scout/tool-executor";
import { SCOUT_TOOLS } from "@/lib/scout/tools";
import type { ScoutToolName } from "@/types/scout";

const ADMIN_ROLES = new Set(["admin", "operator", "leadership"]);
const READ_ONLY_SCOUT_TOOLS = new Set<ScoutToolName>([
  "get_entity",
  "query",
  "aggregate",
  "search_contacts",
  "get_pipeline",
  "get_next_action",
  "get_schedule",
  "get_calendar_availability",
  "get_contact_insights",
  "get_contact_calls",
  "get_tasks",
  "search_knowledge",
  "search_transcripts",
  "search_documents",
  "get_journey_documents",
  "workflow_analyze",
  "trainual_status",
  "get_compliance",
  "territory_performance",
  "network_benchmarks",
  "compare_territories",
  "describe_data",
]);

function parseToolInput(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  if (raw.length > 10000) {
    throw new Error("Tool input is too large. Keep input JSON under 10,000 characters.");
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool input must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

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
    requestParams: {
      limit,
      tool: url.searchParams.get("tool"),
    },
    userAgent: request.headers.get("user-agent"),
  });

  if (resource === "scout_tools") {
    const tools = SCOUT_TOOLS.filter((tool) => READ_ONLY_SCOUT_TOOLS.has(tool.name)).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_schema,
    }));
    return NextResponse.json({
      resource,
      scope: "AI_READ_ONLY",
      requestedBy: token.user,
      tools,
      blockedToolTypes: ["draft_*", "complete_task", "workflow_rewrite", "draft_compliance_update"],
    });
  }

  if (resource === "scout_tool") {
    const toolName = url.searchParams.get("tool") as ScoutToolName | null;
    if (!toolName || !READ_ONLY_SCOUT_TOOLS.has(toolName)) {
      return NextResponse.json(
        {
          error: "Tool is missing or not allowed for AI_READ_ONLY access",
          allowedTools: Array.from(READ_ONLY_SCOUT_TOOLS).sort(),
        },
        { status: 400 }
      );
    }

    let input: Record<string, unknown>;
    try {
      input = parseToolInput(url.searchParams.get("input"));
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid tool input" }, { status: 400 });
    }

    const result = await executeTool(toolName, {
      ...input,
      __aiApiReadOnly: true,
      user_id: token.user_id,
      user_role: token.user.role,
      current_user_id: token.user_id,
    });

    return NextResponse.json({
      resource,
      scope: "AI_READ_ONLY",
      requestedBy: token.user,
      tool: toolName,
      result: result.data,
    });
  }

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
    availableResources: ["overview", "users", "contacts", "l10", "scout_tools", "scout_tool"],
  });
}
