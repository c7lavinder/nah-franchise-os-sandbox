export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/actions/:actionId/rewrite
 *
 * AI-powered field rewrite. Takes the user's instruction + current form fields,
 * sends to Claude, returns rewritten fields.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SCOUT_MODEL = "claude-haiku-4-5-20251001";

interface RewriteBody {
  instruction: string;
  currentFields: Record<string, unknown>;
  category: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string; actionId: string }> }
) {
  await params; // consume params to satisfy Next.js

  const body = (await request.json()) as RewriteBody;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: SCOUT_MODEL,
      max_tokens: 1024,
      system: "You are Scout, an AI assistant. Rewrite the provided form fields based on the user's instruction. Return only a JSON object with the updated field values. Keep the same field keys. Only change the fields relevant to the instruction.",
      messages: [{
        role: "user",
        content: `Category: ${body.category}\nCurrent fields: ${JSON.stringify(body.currentFields)}\n\nInstruction: ${body.instruction}\n\nReturn only valid JSON with the updated fields.`,
      }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );

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
