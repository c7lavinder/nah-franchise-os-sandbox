export const dynamic = "force-dynamic";

/**
 * POST /api/workflows/build
 *
 * Conversational workflow builder endpoint.
 * Receives a user message and conversation history,
 * runs the builder tool-call loop, and returns the response
 * with an optional WorkflowDraft for the preview panel.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runWorkflowBuilderTurn } from "@/lib/workflows/builder-client";
import type Anthropic from "@anthropic-ai/sdk";
import type { WorkflowDraft } from "@/types/workflow-builder";

interface BuildRequestBody {
  message: string;
  history: Anthropic.Messages.MessageParam[];
  workflowId?: string;
  currentDraft?: WorkflowDraft;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const body = (await request.json()) as BuildRequestBody;

    if (!body.message) {
      return NextResponse.json({ error: "Missing required field: message" }, { status: 400 });
    }

    const messages: Anthropic.Messages.MessageParam[] = [
      ...(body.history ?? []),
      { role: "user", content: body.message },
    ];

    const result = await runWorkflowBuilderTurn({
      messages,
      userId: user.id,
      userName: user.fullName,
      currentDraft: body.currentDraft,
      workflowId: body.workflowId,
    });

    return NextResponse.json({
      message: result.responseText,
      workflowDraft: result.workflowDraft ?? null,
      history: result.updatedMessages,
    });
  } catch (err) {
    console.error("Workflow builder error:", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
