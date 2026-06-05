import type Anthropic from "@anthropic-ai/sdk";

const MAX_MESSAGE_CHARS_FOR_MODEL = 120_000;
const MAX_TOOL_RESULT_CHARS_FOR_MODEL = 1_500;
const MAX_BLOCK_TEXT_CHARS_FOR_MODEL = 8_000;

function stringifyContent(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function trimText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated from ${value.length} chars before model request]`;
}

function messageCharCount(message: Anthropic.Messages.MessageParam) {
  if (typeof message.content === "string") return message.content.length;
  return message.content.reduce((total, block) => total + stringifyContent(block).length, 0);
}

function compactMessage(message: Anthropic.Messages.MessageParam): Anthropic.Messages.MessageParam {
  if (typeof message.content === "string") {
    return { ...message, content: trimText(message.content, MAX_BLOCK_TEXT_CHARS_FOR_MODEL) };
  }

  return {
    ...message,
    content: message.content.map((block) => {
      if (block.type === "text") return { ...block, text: trimText(block.text, MAX_BLOCK_TEXT_CHARS_FOR_MODEL) };
      if (block.type === "tool_result") {
        return { ...block, content: trimText(stringifyContent(block.content), MAX_TOOL_RESULT_CHARS_FOR_MODEL) };
      }
      return block;
    }),
  };
}

function hasToolResult(message: Anthropic.Messages.MessageParam) {
  return Array.isArray(message.content) && message.content.some((block) => block.type === "tool_result");
}

function hasToolUse(message: Anthropic.Messages.MessageParam) {
  return Array.isArray(message.content) && message.content.some((block) => block.type === "tool_use");
}

export function trimMessagesForModel(
  history: Anthropic.Messages.MessageParam[],
  maxChars = MAX_MESSAGE_CHARS_FOR_MODEL
): Anthropic.Messages.MessageParam[] {
  const compacted = history.map(compactMessage);
  const kept: Anthropic.Messages.MessageParam[] = [];
  let totalChars = 0;

  for (let i = compacted.length - 1; i >= 0; i--) {
    const message = compacted[i];
    const chars = messageCharCount(message);
    if (kept.length > 0 && totalChars + chars > maxChars) break;

    kept.unshift(message);
    totalChars += chars;

    if (hasToolResult(message) && i > 0 && hasToolUse(compacted[i - 1])) {
      const previous = compacted[i - 1];
      const previousChars = messageCharCount(previous);
      if (totalChars + previousChars <= maxChars) {
        kept.unshift(previous);
        totalChars += previousChars;
        i--;
      }
    }
  }

  while (kept[0] && hasToolResult(kept[0])) kept.shift();
  return kept.length > 0 ? kept : compacted.slice(-1);
}
