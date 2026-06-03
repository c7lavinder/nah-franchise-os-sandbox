export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAgentByName } from "@/lib/agents/agent-registry";

type AgentTrainingEntry = {
  notes: string;
  updatedAt: string;
  updatedBy: string;
  updatedByUserId: string;
};

type TrainingRequest = {
  notes?: string;
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ agentName: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { agentName } = await params;
  const agent = getAgentByName(agentName);
  if (!agent) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as TrainingRequest;
  const notes = (body.notes ?? "").trim();
  if (notes.length > 8000) {
    return NextResponse.json({ error: "Training notes must be 8,000 characters or less" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "agent_training_notes")
    .single();

  const training = parseSetting<Record<string, AgentTrainingEntry>>(existing?.setting_value, {});
  const updatedAt = new Date().toISOString();

  training[agent.name] = {
    notes,
    updatedAt,
    updatedBy: user.fullName,
    updatedByUserId: user.id,
  };

  const { error } = await supabase.from("app_settings").upsert(
    {
      setting_key: "agent_training_notes",
      setting_value: JSON.stringify(training),
      description: "Durable per-agent operator training notes for FranDev AI agents",
    },
    { onConflict: "setting_key" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("integration_logs").insert({
    integration_name: agent.name,
    event_type: "agent_training_updated",
    status: "success",
    payload_summary: `${user.fullName} updated training notes for ${agent.label}. ${notes.length} characters saved.`,
  });

  return NextResponse.json({
    success: true,
    trainingNotes: notes,
    trainingUpdatedAt: updatedAt,
    trainingUpdatedBy: user.fullName,
  });
}
