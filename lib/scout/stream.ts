/**
 * Scout streaming — yields SSE events during the tool-call loop.
 *
 * Event types:
 *   "thinking"  — Scout is processing (tool call in progress)
 *   "tool"      — A tool was called (name + brief result)
 *   "text"      — Partial text from the final response (streamed token-by-token)
 *   "actions"   — Drafted actions produced during the turn
 *   "done"      — Final metadata (sessionId, full history for next turn)
 *   "error"     — Something went wrong
 */

import Anthropic from "@anthropic-ai/sdk";
import { SCOUT_TOOLS } from "./tools";
import { executeTool } from "./tool-executor";
import { logLLMCall } from "./llm-logger";
// routeModel no longer used — Opus orchestrator pattern hardcodes models
import { loadUserMemory, formatMemoryForPrompt } from "./memory";
import { createServerClient } from "@/lib/supabase/server";
import type { ScoutToolName, DraftedAction } from "@/types/scout";
import type { ScoutConversationInput } from "./client";
import type { ScoutPromptMetadata } from "./client";

// Re-use system prompt assembly from the main client.
// We import indirectly to avoid circular deps — the shared bits are
// factored as module-level functions in client.ts that we call through
// the public runConversationTurn, but for streaming we replicate the
// prompt assembly inline (it's just string concatenation).

/** Format tools for the Anthropic API */
function formatToolsForAPI(): Anthropic.Messages.Tool[] {
  return SCOUT_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema as Anthropic.Messages.Tool.InputSchema,
  }));
}

export interface StreamEvent {
  type: "thinking" | "tool" | "text" | "actions" | "done" | "error";
  data: string; // JSON string
}

/**
 * Run a streaming conversation turn. Accepts the same inputs as
 * runConversationTurn but yields SSE events via a callback.
 *
 * The caller must assemble the system prompt BEFORE calling this
 * (use buildSystemPrompt from the chat route). This avoids importing
 * the heavy prompt-assembly functions into two modules.
 */
export async function runStreamingTurn(params: {
  systemPrompt: string;
  messages: Anthropic.Messages.MessageParam[];
  input: ScoutConversationInput;
  ghlUserId: string | null;
  promptMetadata?: ScoutPromptMetadata;
  onEvent: (event: StreamEvent) => void;
}): Promise<void> {
  const { systemPrompt, input, ghlUserId, promptMetadata, onEvent } = params;
  let messages = [...params.messages];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    onEvent({ type: "error", data: JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }) });
    return;
  }

  const client = new Anthropic({ apiKey });
  const tools = formatToolsForAPI();
  // Opus Orchestrator: Opus for iteration 1 (reasoning), Haiku for iterations 2+ (execution)
  const ORCHESTRATOR = "claude-opus-4-6";
  const EXECUTOR = "claude-haiku-4-5-20251001";
  const draftedActions: DraftedAction[] = [];
  const MAX_ITERATIONS = 15;
  const MAX_TOKENS = 2048;

  let iterations = 0;

  // Tool-call loop — non-streaming iterations until we get the final response
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const activeModel = iterations === 1 ? ORCHESTRATOR : EXECUTOR;

    const startTime = Date.now();

    try {
      // Use true streaming via Anthropic SDK.
      // During tool-call iterations we collect the full response.
      // During the final text response we emit tokens as they arrive.
      const stream = client.messages.stream({
        model: activeModel,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools,
        messages,
      });

      // Collect text tokens in real-time — emit them as "text" events.
      // If this turns out to be a tool_use response, these won't fire.
      let streamedText = "";
      stream.on("text", (text) => {
        streamedText += text;
        onEvent({ type: "text", data: JSON.stringify({ text }) });
      });

      // Wait for the full response
      const response = await stream.finalMessage();
      const latencyMs = Date.now() - startTime;

      const toolCallNames = response.content
        .filter((block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use")
        .map((block) => block.name);

      // Log every API call
      logLLMCall({
        userId: input.userId,
        model: activeModel,
        inputMessages: messages,
        toolsProvided: tools.map((t) => t.name),
        responseContent: response.content as unknown[],
        toolCallsMade: toolCallNames,
        tokensInput: response.usage?.input_tokens ?? 0,
        tokensOutput: response.usage?.output_tokens ?? 0,
        latencyMs,
        iteration: iterations,
        caller: "scout_chat_stream",
        promptVersion: promptMetadata?.version,
        promptBlocks: promptMetadata?.blocks,
      }).catch(() => {});

      // Handle tool calls
      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            onEvent({ type: "tool", data: JSON.stringify({ name: block.name }) });

            const toolInput = {
              ...(block.input as Record<string, unknown>),
              _current_user_id: input.userId,
              _current_user_ghl_id: ghlUserId,
            };
            const result = await executeTool(block.name as ScoutToolName, toolInput);

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result.data,
            });

            if (result.draftedAction) {
              draftedActions.push(result.draftedAction);
            }
          }
        }

        messages.push({ role: "user", content: toolResults });
        onEvent({ type: "thinking", data: JSON.stringify({ iteration: iterations }) });
        continue;
      }

      // Final response — text was already streamed via the "text" event handler.
      messages.push({ role: "assistant", content: response.content });
      const fullText = streamedText || "I wasn't able to generate a response.";

      // Send drafted actions if any
      if (draftedActions.length > 0) {
        onEvent({
          type: "actions",
          data: JSON.stringify({ actions: draftedActions }),
        });
      }

      // Send done event with metadata
      onEvent({
        type: "done",
        data: JSON.stringify({
          fullText,
          draftedActions,
          history: messages,
        }),
      });

      return;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown API error";
      logLLMCall({
        userId: input.userId,
        model: activeModel,
        inputMessages: messages,
        toolsProvided: tools.map((t) => t.name),
        responseContent: [],
        toolCallsMade: [],
        tokensInput: 0,
        tokensOutput: 0,
        latencyMs: Date.now() - startTime,
        error: errorMsg,
        iteration: iterations,
        caller: "scout_chat_stream",
        promptVersion: promptMetadata?.version,
        promptBlocks: promptMetadata?.blocks,
      }).catch(() => {});
      onEvent({ type: "error", data: JSON.stringify({ error: errorMsg }) });
      return;
    }
  }

  // Safety: hit max iterations
  onEvent({
    type: "text",
    data: JSON.stringify({
      text: "I ran into an issue processing your request (too many tool calls). Please try rephrasing.",
    }),
  });
  onEvent({
    type: "done",
    data: JSON.stringify({
      fullText: "I ran into an issue processing your request (too many tool calls). Please try rephrasing.",
      draftedActions,
      history: messages,
    }),
  });
}
