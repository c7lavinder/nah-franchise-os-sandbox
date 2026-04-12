export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/generate
 *
 * Triggers Scout to analyze a call transcript and generate:
 * 1. AI summary → calls.ai_summary
 * 2. Coaching → calls.coaching_score + coaching_data
 * 3. Next step action items → call_action_items rows
 * 4. Data extractions → call_data_extractions rows
 *
 * All four produced from a single Claude call.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";

const SCOUT_MODEL = "claude-haiku-4-5-20251001";

interface GenerationResult {
  summary: string;
  coaching: {
    score: number;
    label: string;
    went_well: string[];
    watch_out: string[];
    next_call_prep: string;
  };
  actions: {
    category: string;
    title: string;
    description: string;
    ghl_action: boolean;
    source: string;
  }[];
  extractions: {
    field_key: string;
    field_category: string;
    extracted_value: string | null;
    confidence: string;
  }[];
}

const SYSTEM_PROMPT = `You are Scout, the AI assistant for NAH Franchise OS. You analyze franchise sales call transcripts and extract structured intelligence.`;

function buildUserPrompt(
  transcript: string,
  callType: string | null,
  contactName: string | null
): string {
  return `Analyze this call transcript and return a JSON object with exactly these four keys:

{
  "summary": "2-3 sentence summary covering: candidate's why, capital signals, timeline, tone",
  "coaching": {
    "score": <int 0-100>,
    "label": "<short label e.g. Strong intro call, Needs improvement>",
    "went_well": ["<item>", "<item>"],
    "watch_out": ["<item>"],
    "next_call_prep": "<1-2 sentences>"
  },
  "actions": [
    {
      "category": "<pipeline|apt|task|comms|workflow|data>",
      "title": "<action title>",
      "description": "<1 sentence>",
      "ghl_action": <bool>,
      "source": "scout"
    }
  ],
  "extractions": [
    {
      "field_key": "<snake_case field name from: employment_status, years_in_current_role, timeline_intent, capital_range, lead_source, competitors_mentioned, stated_why, risk_tolerance, family_situation, prior_business_ownership, market_interest, territory_type_preference, availability_confirmed>",
      "field_category": "<contact|territory>",
      "extracted_value": "<value or null if not mentioned>",
      "confidence": "<high|medium|low>"
    }
  ]
}

Return only valid JSON. No preamble, no markdown.

Transcript:
${transcript}

Call type: ${callType ?? "unknown"}
Contact name: ${contactName ?? "unknown"}`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const supabase = createServerClient();

  // Fetch call
  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, call_type_id, raw_transcript, title")
    .eq("id", callId)
    .single();

  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  // Get transcript — prefer call_transcripts table, fall back to raw_transcript on calls
  const { data: transcriptRow } = await supabase
    .from("call_transcripts")
    .select("full_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const transcriptText = transcriptRow?.full_text ?? call.raw_transcript;

  if (!transcriptText) {
    return NextResponse.json(
      { error: "No transcript available for this call" },
      { status: 400 }
    );
  }

  // Resolve call type name
  let callTypeName: string | null = null;
  if (call.call_type_id) {
    const { data: ct } = await supabase
      .from("call_types")
      .select("name")
      .eq("id", call.call_type_id)
      .single();
    if (ct) callTypeName = ct.name;
  }

  // Resolve contact name
  let contactName: string | null = null;
  if (call.contact_id) {
    const { data: c } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", call.contact_id)
      .single();
    if (c) contactName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || null;
  }

  // Call Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  let result: GenerationResult;
  try {
    const response = await client.messages.create({
      model: SCOUT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(transcriptText, callTypeName, contactName),
        },
      ],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );

    if (!textBlock?.text) {
      return NextResponse.json({ error: "No response from Scout" }, { status: 500 });
    }

    result = JSON.parse(textBlock.text) as GenerationResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Scout generation failed: ${msg}` }, { status: 500 });
  }

  const now = new Date().toISOString();

  // 1. Save summary + coaching to calls table
  await supabase
    .from("calls")
    .update({
      ai_summary: result.summary,
      ai_summary_generated_at: now,
      coaching_score: result.coaching.score,
      coaching_data: result.coaching,
      coaching_generated_at: now,
    })
    .eq("id", callId);

  // 2. Insert action items
  if (result.actions?.length > 0) {
    // Clear previous scout-generated actions for this call
    await supabase
      .from("call_action_items")
      .delete()
      .eq("call_id", callId)
      .eq("source", "scout")
      .eq("status", "pending");

    const actionRows = result.actions.map((a) => ({
      call_id: callId,
      contact_id: call.contact_id ?? null,
      category: a.category,
      title: a.title,
      description: a.description ?? null,
      source: "scout",
      ghl_action: a.ghl_action ?? false,
      status: "pending",
    }));

    await supabase.from("call_action_items").insert(actionRows);
  }

  // 3. Insert data extractions
  if (result.extractions?.length > 0) {
    // Clear previous scout extractions for this call
    await supabase
      .from("call_data_extractions")
      .delete()
      .eq("call_id", callId)
      .eq("source", "scout")
      .eq("saved_to_profile", false)
      .eq("dismissed", false);

    const extractionRows = result.extractions
      .filter((e) => e.extracted_value !== null)
      .map((e) => ({
        call_id: callId,
        contact_id: call.contact_id ?? null,
        field_key: e.field_key,
        field_category: e.field_category,
        extracted_value: e.extracted_value,
        confidence: e.confidence,
        source: "scout",
      }));

    if (extractionRows.length > 0) {
      await supabase.from("call_data_extractions").insert(extractionRows);
    }
  }

  return NextResponse.json({
    success: true,
    summary: result.summary,
    coaching: result.coaching,
    actionsCount: result.actions?.length ?? 0,
    extractionsCount: result.extractions?.filter((e) => e.extracted_value !== null).length ?? 0,
  });
}
