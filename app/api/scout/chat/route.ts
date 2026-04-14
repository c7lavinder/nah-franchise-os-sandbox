export const dynamic = "force-dynamic";

/**
 * POST /api/scout/chat
 *
 * Receives a user message and the conversation history,
 * runs the Scout tool-call loop, and returns Scout's response.
 * Also persists conversation to the session in Supabase.
 */

import { NextRequest, NextResponse } from "next/server";
import { runConversationTurn } from "@/lib/scout";
import { createServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";
import type Anthropic from "@anthropic-ai/sdk";

interface ChatRequestBody {
  message: string;
  sessionId: string | null;
  /** Existing conversation messages to continue from */
  history: Anthropic.Messages.MessageParam[];
  userId: string;
  userRole: UserRole;
  userName: string;
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
  try {
    const body = (await request.json()) as ChatRequestBody;

    if (!body.message || !body.userId) {
      return NextResponse.json(
        { error: "Missing required fields: message, userId" },
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
      userId: body.userId,
      userRole: body.userRole ?? "rep",
      userName: body.userName ?? "User",
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
            user_id: body.userId,
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
          user_id: body.userId,
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
