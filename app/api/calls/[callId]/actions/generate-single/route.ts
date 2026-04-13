export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/actions/generate-single
 * Generate a single action item from a natural language instruction.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { stripFences } from "@/lib/agents/post-call/call-claude";

const MODEL = "claude-haiku-4-5-20251001";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const { instruction } = (await request.json()) as { instruction: string };

  if (!instruction?.trim()) {
    return NextResponse.json({ error: "Instruction required" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Load call context
  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, title, started_at")
    .eq("id", callId)
    .single();
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  // Get contact name
  let contactName = "Unknown";
  if (call.contact_id) {
    const { data: c } = await supabase.from("contacts").select("first_name, last_name").eq("id", call.contact_id).single();
    if (c) contactName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown";
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: "You are Scout, an AI assistant for NAH Franchise OS. Generate exactly one action item from the user's instruction.",
      messages: [{
        role: "user",
        content: `Generate one action item based on this instruction: "${instruction}"

Contact: ${contactName}
Call: ${call.title ?? "Unknown"}
Date: ${call.started_at ?? "Unknown"}

Return a JSON object with: category (apt|comms|task|note|pipeline|data), title, description, why, contact_name, assigned_to_name, ghl_action (bool), source ("manual"), metadata (with all relevant fields for the category).

Return only valid JSON. No markdown fences.`,
      }],
    });

    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "No response from Scout" }, { status: 500 });

    const action = JSON.parse(stripFences(text));

    // Insert into DB
    const { data: row } = await supabase.from("call_action_items").insert({
      call_id: callId,
      contact_id: call.contact_id,
      category: action.category ?? "task",
      title: action.title ?? instruction,
      description: action.description ?? null,
      why: action.why ?? null,
      contact_name: action.contact_name ?? contactName,
      assigned_to_name: action.assigned_to_name ?? "Chad Arnold",
      metadata: action.metadata ?? null,
      source: "manual",
      ghl_action: action.ghl_action ?? false,
      status: "pending",
    }).select("id").single();

    return NextResponse.json({ success: true, actionId: row?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
