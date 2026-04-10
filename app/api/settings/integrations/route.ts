export const dynamic = "force-dynamic";

/**
 * GET /api/settings/integrations
 *
 * Returns connection status for all integrations plus system health:
 * - GHL connection (OAuth or API key)
 * - Anthropic API key
 * - Whisper API key
 * - Data health: custom fields cached, pipelines synced, knowledge docs loaded
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();

  // Check GHL OAuth status
  let ghlConnected = false;
  let ghlConnectedAt: string | null = null;
  try {
    const { data: tokenRow } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "ghl_access_token")
      .single();

    if (tokenRow?.setting_value) {
      ghlConnected = true;
      const { data: connRow } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "ghl_oauth_connected_at")
        .single();
      ghlConnectedAt = connRow?.setting_value
        ? JSON.parse(connRow.setting_value)
        : null;
    }
  } catch {
    // Not connected
  }

  const ghlPitKey = !!process.env.GHL_API_KEY;
  const anthropicConnected = !!process.env.ANTHROPIC_API_KEY;
  const whisperConnected = !!process.env.OPENAI_API_KEY;

  // Check PDL connection
  let pdlConnected = false;
  try {
    const { data: pdlRow } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "pdl_api_key")
      .single();
    pdlConnected = !!pdlRow?.setting_value;
  } catch { /* not connected */ }

  // Data health checks
  let customFieldsCached = 0;
  let pipelinesCached = 0;
  let knowledgeDocs = 0;
  let activeAlerts = 0;
  let totalUsers = 0;

  try {
    const [fieldsRes, stagesRes, knowledgeRes, alertsRes, usersRes] = await Promise.all([
      supabase.from("ghl_custom_fields").select("id", { count: "exact", head: true }),
      supabase.from("ghl_pipeline_stages").select("id", { count: "exact", head: true }),
      supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("inactivity_alerts").select("id", { count: "exact", head: true }).eq("is_resolved", false),
      supabase.from("users").select("id", { count: "exact", head: true }),
    ]);

    customFieldsCached = fieldsRes.count ?? 0;
    pipelinesCached = stagesRes.count ?? 0;
    knowledgeDocs = knowledgeRes.count ?? 0;
    activeAlerts = alertsRes.count ?? 0;
    totalUsers = usersRes.count ?? 0;
  } catch {
    // Continue with zeros
  }

  // Build setup checklist
  const setupChecklist = [
    { label: "GHL Connected", done: ghlConnected || ghlPitKey, detail: ghlConnected ? "OAuth" : ghlPitKey ? "API Key" : "Not connected" },
    { label: "Anthropic API Key", done: anthropicConnected, detail: anthropicConnected ? "Configured" : "Missing — Scout won't work" },
    { label: "Custom Fields Synced", done: customFieldsCached > 0, detail: customFieldsCached > 0 ? `${customFieldsCached} fields cached` : "Run setup script" },
    { label: "Pipeline Stages Synced", done: pipelinesCached > 0, detail: pipelinesCached > 0 ? `${pipelinesCached} stages cached` : "Run setup script" },
    { label: "Knowledge Base Loaded", done: knowledgeDocs > 0, detail: knowledgeDocs > 0 ? `${knowledgeDocs} documents` : "Add docs in Knowledge page" },
    { label: "Users Created", done: totalUsers > 0, detail: totalUsers > 0 ? `${totalUsers} users` : "No users in database" },
  ];

  const setupComplete = setupChecklist.filter((c) => c.done).length;
  const setupTotal = setupChecklist.length;

  return NextResponse.json({
    ghl: {
      connected: ghlConnected || ghlPitKey,
      method: ghlConnected ? "oauth" : ghlPitKey ? "api_key" : "none",
      connectedAt: ghlConnectedAt,
    },
    anthropic: { connected: anthropicConnected },
    whisper: { connected: whisperConnected },
    pdl: { connected: pdlConnected },
    health: {
      customFieldsCached,
      pipelinesCached,
      knowledgeDocs,
      activeAlerts,
      totalUsers,
    },
    setup: {
      checklist: setupChecklist,
      complete: setupComplete,
      total: setupTotal,
      ready: setupComplete === setupTotal,
    },
  });
}
