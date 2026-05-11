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
import { checkRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { runConversationTurn } from "@/lib/scout";
import { loadUserMemory, mergeUserMemory } from "@/lib/scout/memory";
import { createServerClient } from "@/lib/supabase/server";
import type Anthropic from "@anthropic-ai/sdk";

/** Max chars for a single tool result in stored conversation history */
const MAX_TOOL_RESULT_CHARS = 2000;

/**
 * Truncate tool results in conversation history to prevent oversized JSONB payloads.
 */
function truncateHistoryForStorage(history: Anthropic.Messages.MessageParam[]): Anthropic.Messages.MessageParam[] {
  return history.map((msg) => {
    if (msg.role !== "user" || !Array.isArray(msg.content)) return msg;
    const hasToolResult = (msg.content as any[]).some((b: any) => b.type === "tool_result");
    if (!hasToolResult) return msg;

    return {
      ...msg,
      content: (msg.content as any[]).map((block: any) => {
        if (block.type !== "tool_result") return block;
        const content = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
        if (content.length <= MAX_TOOL_RESULT_CHARS) return block;
        return {
          ...block,
          content: content.slice(0, MAX_TOOL_RESULT_CHARS) + `\n...[truncated from ${content.length} chars]`,
        };
      }),
    };
  });
}

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

  const rateLimited = checkRateLimit(user.id, RATE_LIMITS.scoutChat);
  if (rateLimited) return rateLimited;

  try {
    const body = (await request.json()) as ChatRequestBody;

    if (!body.message) {
      return NextResponse.json({ error: "Missing required field: message" }, { status: 400 });
    }

    // Build the messages array — existing history + new user message
    const messages: Anthropic.Messages.MessageParam[] = [...body.history, { role: "user", content: body.message }];

    // Run the full conversation turn with tool-call loop
    const result = await runConversationTurn({
      messages,
      userId: user.id,
      userRole: user.role,
      userName: user.fullName,
      pageContext: body.pageContext,
    });

    // Persist session — never overwrite existing session with empty history
    let sessionId = body.sessionId;
    try {
      const supabase = createServerClient();
      const storableHistory = truncateHistoryForStorage(result.updatedMessages);

      if (storableHistory.length >= 2) {
        if (sessionId) {
          const { error: updateErr } = await supabase
            .from("sessions")
            .update({
              conversation_history: storableHistory as unknown as Record<string, unknown>[],
              last_activity_at: new Date().toISOString(),
            })
            .eq("id", sessionId);
          if (updateErr) console.error("Scout session update failed:", updateErr.message);
        } else {
          const { data: newSession, error: insertErr } = await supabase
            .from("sessions")
            .insert({
              user_id: user.id,
              conversation_history: storableHistory as unknown as Record<string, unknown>[],
              is_active: true,
            })
            .select("id")
            .single();
          if (insertErr) console.error("Scout session insert failed:", insertErr.message);
          sessionId = newSession?.id ?? null;
        }
      } else if (sessionId) {
        console.warn(`Scout: skipping session update — empty history would erase session ${sessionId}`);
      }
    } catch (err) {
      console.error("Scout session persistence failed:", err instanceof Error ? err.message : err);
    }

    // Log all drafted actions
    if (result.draftedActions.length > 0) {
      try {
        const supabase = createServerClient();
        const { error: actionErr } = await supabase.from("scout_action_logs").insert(
          result.draftedActions.map((da) => ({
            user_id: user.id,
            session_id: sessionId ?? "00000000-0000-0000-0000-000000000000",
            action_type: da.type,
            action_status: "drafted",
            ghl_contact_id: da.contactId,
            draft_content: da.payload as unknown as Record<string, unknown>,
          }))
        );
        if (actionErr) console.error("Scout action log failed:", actionErr.message);
      } catch (err) {
        console.error("Scout action log failed:", err instanceof Error ? err.message : err);
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
      draftedActions: result.draftedActions,
      sessionId,
      /** Return the updated messages so the frontend can send them back on the next turn */
      history: result.updatedMessages,
    });
  } catch (err) {
    console.error("Scout chat error:", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
