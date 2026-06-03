export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { AGENT_CATEGORIES, AGENT_REGISTRY } from "@/lib/agents/agent-registry";

type AgentTrainingEntry = {
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
};

function parseSetting<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const supabase = createServerClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Get agent toggles from app_settings
  const { data: toggleSetting } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "agent_toggles")
    .single();

  const toggles = parseSetting<Record<string, boolean>>(toggleSetting?.setting_value, {});

  const { data: trainingSetting } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "agent_training_notes")
    .single();

  const trainingNotes = parseSetting<Record<string, AgentTrainingEntry>>(trainingSetting?.setting_value, {});

  const agents = [];

  for (const def of AGENT_REGISTRY) {
    // Count runs MTD
    const runQuery = supabase
      .from("integration_logs")
      .select("id", { count: "exact", head: true })
      .eq("integration_name", def.name)
      .gte("created_at", monthStart);

    const { count: runsMTD } = await runQuery;

    const { data: lastRun } = await supabase
      .from("integration_logs")
      .select("created_at, status, error_message")
      .eq("integration_name", def.name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Count suggestions MTD. Post-call writes to call_data_extractions;
    // the other agents write to data_update_suggestions.
    let suggestionsMTD = 0;
    if (def.name === "post-call") {
      const { count } = await supabase
        .from("call_data_extractions")
        .select("id", { count: "exact", head: true })
        .eq("source", "scout")
        .gte("created_at", monthStart);
      suggestionsMTD = count ?? 0;
    } else {
      const { count } = await supabase
        .from("data_update_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("source", "agent_research")
        .ilike("source_id", `${def.name}%`)
        .gte("created_at", monthStart);
      suggestionsMTD = count ?? 0;
    }

    const costEst = ((runsMTD ?? 0) * 0.002).toFixed(2);

    agents.push({
      ...def,
      enabled: def.status !== "planned" && toggles[def.name] !== false,
      runsMTD: runsMTD ?? 0,
      suggestionsMTD,
      costEstMTD: `$${costEst}`,
      lastRunAt: lastRun?.created_at ?? null,
      lastStatus: lastRun?.status ?? null,
      lastError: lastRun?.error_message ?? null,
      trainingNotes: trainingNotes[def.name]?.notes ?? "",
      trainingUpdatedAt: trainingNotes[def.name]?.updatedAt ?? null,
      trainingUpdatedBy: trainingNotes[def.name]?.updatedBy ?? null,
    });
  }

  return NextResponse.json({ categories: AGENT_CATEGORIES, agents });
}
