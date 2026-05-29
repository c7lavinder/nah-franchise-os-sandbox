/**
 * LLM Call Logger — records every Claude API call to Supabase.
 *
 * Every Claude API interaction (Scout chat, rewrite engine, etc.)
 * must be logged through this module for debugging, cost tracking,
 * and improving Scout over time.
 *
 * Logging is fire-and-forget: failures are caught and logged to
 * console, never breaking the caller's flow.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { PromptBlockMetadata } from "./prompt-loader";

/** Parameters for logging a single Claude API call */
export interface LLMCallLogParams {
  /** The user who triggered the call (optional for system-initiated calls) */
  userId?: string;
  /** The session ID if this call happened within a Scout chat session */
  sessionId?: string;
  /** The Claude model used (e.g. "claude-haiku-4-5-20251001") */
  model: string;
  /** The full input messages array sent to Claude */
  inputMessages: unknown[];
  /** Names of tools provided to Claude in this call */
  toolsProvided: string[];
  /** The full response content blocks from Claude */
  responseContent: unknown[];
  /** Names of tool calls Claude made in its response */
  toolCallsMade: string[];
  /** Number of input tokens consumed */
  tokensInput: number;
  /** Number of output tokens generated */
  tokensOutput: number;
  /** Wall-clock latency in milliseconds */
  latencyMs: number;
  /** Error message if the call failed */
  error?: string;
  /** Which iteration of a tool-call loop this was (default 1) */
  iteration?: number;
  /** Caller identifier — e.g. "scout_chat", "rewrite_engine" */
  caller?: string;
  /** Composite version hash of prompt blocks sent as the Anthropic system prompt */
  promptVersion?: string;
  /** Compact per-block prompt metadata for audit/debugging without storing extra prompt text */
  promptBlocks?: PromptBlockMetadata[];
}

/**
 * Logs a complete Claude API interaction to Supabase.
 *
 * Fire-and-forget — never throws, never blocks the caller.
 * Returns the log row ID on success, or null on failure.
 */
export async function logLLMCall(params: LLMCallLogParams): Promise<string | null> {
  try {
    const supabase = createServerClient();

    const insertPayload = {
        user_id: params.userId ?? null,
        model: params.model,
        input_messages: params.inputMessages as unknown as Record<string, unknown>,
        output_content: params.responseContent as unknown as Record<string, unknown>,
        tool_calls: params.toolCallsMade.length > 0
          ? (params.toolCallsMade as unknown as Record<string, unknown>)
          : ([] as unknown as Record<string, unknown>),
        stop_reason: params.error ? "error" : null,
        input_tokens: params.tokensInput,
        output_tokens: params.tokensOutput,
        latency_ms: params.latencyMs,
        error_message: params.error ?? null,
        iteration: params.iteration ?? 1,
        prompt_version: params.promptVersion ?? null,
        prompt_blocks: (params.promptBlocks ?? []) as unknown as Record<string, unknown>,
      };

    let { data, error } = await supabase
      .from("llm_call_logs")
      .insert(insertPayload)
      .select("id")
      .single();

    // Backward compatibility for environments that have not applied the
    // prompt metadata migration yet. Logging still works; metadata starts
    // flowing once the migration lands.
    if (
      error &&
      (error.message.includes("prompt_version") || error.message.includes("prompt_blocks"))
    ) {
      const { prompt_version: _promptVersion, prompt_blocks: _promptBlocks, ...legacyPayload } = insertPayload;
      const retry = await supabase.from("llm_call_logs").insert(legacyPayload).select("id").single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("LLM log insert failed:", error.message);
      return null;
    }

    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    // Logging is non-critical — never break the caller
    console.error(
      "Failed to log LLM call:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return null;
  }
}
