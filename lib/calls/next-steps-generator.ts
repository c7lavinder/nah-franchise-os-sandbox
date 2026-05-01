/**
 * Next Steps Generator
 *
 * Takes call transcript + grade + profile + pipeline state and generates
 * 3-7 suggested next actions as Edit/Skip/Push cards.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";

export interface NextStepCard {
  id: string;
  title: string;
  description: string;
  action_type: "nah_os" | "ghl";
  action_payload: Record<string, unknown>;
  priority: "high" | "medium" | "low";
  outcome?: "pushed" | "edited" | "skipped";
}

const NEXT_STEPS_PROMPT = `You are Scout, the AI brain of the New Again Houses franchise sales platform.
Based on this call, generate 3-7 suggested next actions for the rep.

RULES:
- Each action should be specific and actionable
- Pre-fill as much data as possible (contact ID, draft message text, calendar type, etc.)
- Categorize each as either "nah_os" (internal platform action) or "ghl" (GoHighLevel CRM action)
- NAH OS actions: log sub-task, advance stage, update profile field, create internal note
- GHL actions: send SMS, send email, schedule call, create task, add tag, internal note
- Order by priority (most important first)
- Be specific to what happened in the call — not generic

CALL CONTEXT:
CONTEXT_BLOCK

Respond with ONLY valid JSON:
{
  "next_steps": [
    {
      "title": "Brief action title",
      "description": "Why Scout suggests this",
      "action_type": "nah_os|ghl",
      "action_payload": { "type": "...", ...prefilled params },
      "priority": "high|medium|low"
    }
  ]
}`;

export async function generateNextSteps(callId: string): Promise<NextStepCard[]> {
  const supabase = createServerClient();

  // Fetch call data
  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, call_type_id, hosted_by_user_id, duration_seconds")
    .eq("id", callId)
    .single();
  if (!call) throw new Error("Call not found");

  // Fetch transcript
  const { data: transcript } = await supabase
    .from("call_transcripts")
    .select("full_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!transcript) throw new Error("No transcript found");

  // Fetch grade
  const { data: grade } = await supabase
    .from("call_grades")
    .select("overall_grade, overall_score, suggested_next_action")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch contact info
  let contactName = "Unknown";
  let currentStage = "Unknown";
  if (call.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", call.contact_id)
      .single();
    if (contact) contactName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unknown";

    // Phase 4 read migration: source stage from journey_pipeline_state via
    // the journey whose primary is this contact.
    const { data: jps } = await supabase
      .from("journey_pipeline_state")
      .select("current_stage_id, pipeline_stages(name), journeys!inner(primary_contact_id)")
      .eq("journeys.primary_contact_id", call.contact_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (jps) {
      const stage = jps.pipeline_stages as unknown as { name: string } | null;
      currentStage = stage?.name ?? "Unknown";
    }
  }

  // Fetch call type name
  let callTypeName = "Unknown";
  if (call.call_type_id) {
    const { data: ct } = await supabase.from("call_types").select("name").eq("id", call.call_type_id).single();
    callTypeName = ct?.name ?? "Unknown";
  }

  const contextBlock = `Contact: ${contactName}
Contact ID: ${call.contact_id ?? "N/A"}
Call Type: ${callTypeName}
Pipeline Stage: ${currentStage}
Duration: ${call.duration_seconds ? `${Math.round(call.duration_seconds / 60)} minutes` : "Unknown"}
Grade: ${grade ? `${grade.overall_grade} (${grade.overall_score}/100)` : "Not graded yet"}
Grader's suggestion: ${grade?.suggested_next_action ?? "N/A"}`;

  const prompt = NEXT_STEPS_PROMPT.replace("CONTEXT_BLOCK", contextBlock);

  const model = process.env.SCOUT_MODEL ?? "claude-haiku-4-5-20251001";
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\nTRANSCRIPT:\n${transcript.full_text}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]) as {
    next_steps: Array<{
      title: string;
      description: string;
      action_type: "nah_os" | "ghl";
      action_payload: Record<string, unknown>;
      priority: "high" | "medium" | "low";
    }>;
  };

  return (parsed.next_steps ?? []).slice(0, 7).map((step, i) => ({
    id: `ns-${callId}-${i}`,
    title: step.title,
    description: step.description,
    action_type: step.action_type,
    action_payload: step.action_payload,
    priority: step.priority,
  }));
}
