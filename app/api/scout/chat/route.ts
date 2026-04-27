export const dynamic = "force-dynamic";

/**
 * POST /api/scout/chat
 *
 * Receives a user message and the conversation history,
 * runs the Scout tool-call loop, and returns Scout's response.
 * Also persists conversation to the session in Supabase.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runConversationTurn } from "@/lib/scout";
import { loadUserMemory, mergeUserMemory } from "@/lib/scout/memory";
import { createServerClient } from "@/lib/supabase/server";
import type Anthropic from "@anthropic-ai/sdk";

interface ChatRequestBody {
  message: string;
  sessionId: string | null;
  /** Existing conversation messages to continue from */
  history: Anthropic.Messages.MessageParam[];
  /** Page context for context-aware KB loading */
  pageContext?: {
    page: string;
    callType?: string;
    contactId?: string;
    territorySlug?: string;
    pipelineStage?: string;
  };
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const body = (await request.json()) as ChatRequestBody;

    if (!body.message) {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 }
      );
    }

    // Build the messages array — existing history + new user message
    const messages: Anthropic.Messages.MessageParam[] = [
      ...body.history,
      { role: "user", content: body.message },
    ];

    // Run the full conversation turn with tool-call loop
    const result = await runConversationTurn({
      messages,
      userId: user.id,
      userRole: user.role,
      userName: user.fullName,
      pageContext: body.pageContext,
    });

    // Persist session to Supabase
    let sessionId = body.sessionId;
    try {
      const supabase = createServerClient();

      if (sessionId) {
        // Update existing session
        await supabase
          .from("sessions")
          .update({
            conversation_history: result.updatedMessages as unknown as Record<string, unknown>[],
            last_activity_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
      } else {
        // Create new session
        const { data: newSession } = await supabase
          .from("sessions")
          .insert({
            user_id: user.id,
            conversation_history: result.updatedMessages as unknown as Record<string, unknown>[],
            is_active: true,
          })
          .select("id")
          .single();

        sessionId = newSession?.id ?? null;
      }
    } catch {
      // Session persistence is non-critical — don't fail the request
      console.error("Failed to persist session — continuing without save");
    }

    // Log the action if a draft was produced
    if (result.draftedAction) {
      try {
        const supabase = createServerClient();
        await supabase.from("scout_action_logs").insert({
          user_id: user.id,
          session_id: sessionId ?? "00000000-0000-0000-0000-000000000000",
          action_type: result.draftedAction.type,
          action_status: "drafted",
          ghl_contact_id: result.draftedAction.contactId,
          draft_content: result.draftedAction.payload as unknown as Record<string, unknown>,
        });
      } catch {
        console.error("Failed to log Scout action — continuing");
      }
    }

    // Merge durable facts from this turn into the user's persistent memory.
    // Fire-and-forget: never blocks the response, never breaks the chat.
    const memoryMergePromise = (async () => {
      try {
        const existingMemory = await loadUserMemory(user.id);
        await mergeUserMemory({
          userId: user.id,
          userName: user.fullName,
          existingMemory,
          userMessage: body.message,
          assistantResponse: result.responseText,
          draftedActionType: result.draftedAction?.type,
        });
      } catch {
        // Memory merge is best-effort
      }
    })();
    void memoryMergePromise;

    return NextResponse.json({
      message: result.responseText,
      draftedAction: result.draftedAction ?? null,
      sessionId,
      /** Return the updated messages so the frontend can send them back on the next turn */
      history: result.updatedMessages,
    });
  } catch (err) {
    console.error("Scout chat error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
