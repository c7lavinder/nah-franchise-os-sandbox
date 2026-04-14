/**
 * Shared Claude API caller for post-call agent sections.
 * Each section provides a system prompt, user prompt, and parse function.
 */

import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

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
  // Remove opening fence: ```json, ```javascript, ``` etc.
  cleaned = cleaned.replace(/^```\w*\s*\n?/i, "");
  // Remove closing fence
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  return cleaned.trim();
}

export async function callClaude<T>(options: CallClaudeOptions<T>): Promise<T | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: options.maxTokens ?? 25000,
    system: options.systemPrompt,
    messages: [{ role: "user", content: options.userPrompt }],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );

  if (!textBlock?.text) return null;

  return options.parse(textBlock.text);
}
