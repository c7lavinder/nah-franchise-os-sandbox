/**
 * Shared Claude API caller for post-call agent sections.
 * Each section provides a system prompt, user prompt, and parse function.
 * Includes retry with exponential backoff for API resilience.
 */

import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface CallClaudeOptions<T> {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  parse: (rawText: string) => T | null;
  maxTokens?: number;
}

/** Strip markdown code fences that Claude sometimes wraps around JSON */
export function stripFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```\w*\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  return cleaned.trim();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callClaude<T>(options: CallClaudeOptions<T>): Promise<T | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: options.model ?? DEFAULT_MODEL,
        max_tokens: options.maxTokens ?? 25000,
        system: options.systemPrompt,
        messages: [{ role: "user", content: options.userPrompt }],
      });

      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );

      if (!textBlock?.text) {
        console.error(`[call-claude] Attempt ${attempt}: no text in response`);
        lastError = new Error("No text in Claude response");
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          continue;
        }
        return null;
      }

      const parsed = options.parse(textBlock.text);
      if (parsed === null && attempt < MAX_RETRIES) {
        console.error(`[call-claude] Attempt ${attempt}: parse returned null, retrying`);
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }

      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.message.includes("timeout") ||
        lastError.message.includes("529") ||
        lastError.message.includes("overloaded") ||
        lastError.message.includes("rate_limit") ||
        lastError.message.includes("500") ||
        lastError.message.includes("502") ||
        lastError.message.includes("503");

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.error(`[call-claude] Attempt ${attempt} failed (${lastError.message}), retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      // Non-retryable or exhausted retries
      console.error(`[call-claude] Failed after ${attempt} attempts:`, lastError.message);
      throw lastError;
    }
  }

  console.error("[call-claude] Exhausted retries:", lastError?.message);
  return null;
}
