export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/actions/:actionId/rewrite
 *
 * AI-powered field rewrite. Takes the user's instruction + current form fields,
 * sends to Claude with transcript context, returns rewritten fields.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";

const MODEL = "claude-haiku-4-5-20251001";

interface RewriteBody {
  instruction: string;
  currentFields: Record<string, unknown>;
  category: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string; actionId: string }> }
) {
  const { callId } = await params;
  const body = (await request.json()) as RewriteBody;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const supabase = createServerClient();

  // Load transcript for context
  const { data: transcriptRow } = await supabase
    .from("call_transcripts")
    .select("full_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Load contact name
  const { data: call } = await supabase.from("calls").select("contact_id, title").eq("id", callId).single();

  let contactName = "the contact";
  if (call?.contact_id) {
    const { data: c } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", call.contact_id)
      .single();
    if (c) contactName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "the contact";
  }

  const transcript = transcriptRow?.full_text ?? "";
  // Trim transcript to last ~3000 chars for token budget
  const trimmedTranscript = transcript.length > 3000 ? "...\n" + transcript.slice(-3000) : transcript;

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `You are Scout, an AI assistant for NAH Franchise OS. Rewrite the provided form fields based on the user's instruction. Use the call transcript to make the rewrite accurate and specific — reference real details from the conversation. Return only a JSON object with the updated field values. Keep the same field keys. Only change the fields relevant to the instruction.`,
      messages: [
        {
          role: "user",
          content: `Category: ${body.category}
Contact: ${contactName}
Call: ${call?.title ?? "Unknown"}
Current fields: ${JSON.stringify(body.currentFields)}

${trimmedTranscript ? `Transcript (for reference):\n${trimmedTranscript}\n` : ""}
Instruction: ${body.instruction}

Return only valid JSON with the updated fields.`,
        },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");

    if (!textBlock?.text) {
      return NextResponse.json({ error: "No response from Scout" }, { status: 500 });
    }

    const cleanJson = textBlock.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const fields = JSON.parse(cleanJson) as Record<string, string>;
    return NextResponse.json({ fields });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
