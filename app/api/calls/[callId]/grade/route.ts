/**
 * POST /api/calls/[callId]/grade
 *
 * Sends call transcript to Scout (Claude) for grading, coaching, and action generation.
 * Returns structured analysis with score, coaching tips, and suggested actions.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface GradeRequest {
  transcript: string;
  contactName: string;
  callType?: string;
  currentStage?: string;
}

interface GradeResult {
  score: string;
  scoreNumeric: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  coachingTips: string[];
  suggestedActions: SuggestedAction[];
}

interface SuggestedAction {
  type: "note" | "task" | "stage_move" | "sms" | "email" | "workflow";
  label: string;
  description: string;
  content: string;
  targetStage?: string;
}

const GRADING_PROMPT = `You are Scout, an expert franchise sales coach for New Again Houses (NAH). You are grading a sales call and providing coaching.

GRADING RUBRIC (score each 1-10):
1. RAPPORT — Did the rep build connection? Was the tone warm and professional?
2. QUALIFICATION — Did the rep assess capital availability, timeline, territory interest, and motivation?
3. OBJECTION HANDLING — Did the rep address concerns about cost, timing, competition, or territory?
4. NEXT STEP — Did the rep establish a clear next action (book call, send info, move stage)?
5. TRAINUAL/PTO — Did the rep mention or encourage the Path to Ownership / Trainual?
6. KNOWLEDGE — Did the rep demonstrate understanding of NAH, the franchise model, and the industry?

OVERALL GRADE: Average of all categories.
A = 9-10 | B = 7-8 | C = 5-6 | D = 3-4 | F = 1-2

RESPONSE FORMAT — Return ONLY valid JSON:
{
  "score": "B+",
  "scoreNumeric": 78,
  "summary": "One sentence summary of the call outcome",
  "strengths": ["What the rep did well — 2-3 items"],
  "improvements": ["What to improve — 2-3 items"],
  "coachingTips": ["Specific actionable coaching — 2-3 tips"],
  "suggestedActions": [
    {
      "type": "note",
      "label": "Log Call Notes",
      "description": "Push call summary to GHL",
      "content": "The actual note text to push"
    },
    {
      "type": "task",
      "label": "Follow Up Task",
      "description": "Create a follow-up task",
      "content": "Task title and details"
    },
    {
      "type": "sms",
      "label": "Send Follow-Up Text",
      "description": "Draft a follow-up SMS",
      "content": "The SMS text"
    },
    {
      "type": "stage_move",
      "label": "Move to Next Stage",
      "description": "Advance the pipeline",
      "content": "Reason for move",
      "targetStage": "Stage name"
    }
  ]
}

Only suggest actions that make sense based on the call. Don't force actions that aren't warranted.
If the transcript is short or unclear, grade conservatively and note that limited information was available.`;

export async function POST(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const body = (await request.json()) as GradeRequest;

    if (!body.transcript?.trim()) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const userMessage = [
      `Contact: ${body.contactName}`,
      body.callType ? `Call Type: ${body.callType}` : null,
      body.currentStage ? `Current Pipeline Stage: ${body.currentStage}` : null,
      "",
      "TRANSCRIPT:",
      body.transcript,
    ].filter(Boolean).join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 2000,
      system: GRADING_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text from response
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse grading response" }, { status: 500 });
    }

    const grade = JSON.parse(jsonMatch[0]) as GradeResult;
    return NextResponse.json({ grade, callId: params.callId });
  } catch (err) {
    console.error("Call grading failed:", err);
    return NextResponse.json({ error: "Failed to grade call" }, { status: 500 });
  }
}
