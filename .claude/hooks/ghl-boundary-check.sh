#!/bin/bash

# PreToolUse(Edit) hook: blocks edits that introduce GHL API calls or Anthropic SDK
# imports outside their designated wrappers.
# Exit 2 = block. Exit 0 = allow.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
NEW_STRING=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty')

# Skip if no file path or new content
if [[ -z "$FILE_PATH" ]] || [[ -z "$NEW_STRING" ]]; then
  exit 0
fi

# Only check files in lib/ and app/api/ (handles both absolute and relative paths)
case "$FILE_PATH" in
  */lib/*|*/app/api/*|lib/*|app/api/*) ;;
  *) exit 0 ;;
esac

# --- GHL boundary check ---
# Allow lib/ghl/client.ts itself
if [[ "$FILE_PATH" != *"lib/ghl/client.ts" ]]; then
  if echo "$NEW_STRING" | grep -qiE 'leadconnectorhq\.com|services\.leadconnectorhq'; then
    echo "BLOCKED: GHL API calls must go through lib/ghl/client.ts." >&2
    echo "File: $FILE_PATH" >&2
    echo "Found: direct GHL API URL reference." >&2
    echo "Fix: Use the existing GHL wrapper in lib/ghl/client.ts or extend it." >&2
    exit 2
  fi
fi

# --- Scout / Anthropic boundary check ---
# Allow files within lib/scout/
if [[ "$FILE_PATH" != *"lib/scout/"* ]]; then
  if echo "$NEW_STRING" | grep -qE '@anthropic-ai/sdk|from "anthropic"|import Anthropic|new Anthropic\('; then
    echo "BLOCKED: Anthropic SDK calls must go through lib/scout/." >&2
    echo "File: $FILE_PATH" >&2
    echo "Found: direct Anthropic SDK import or usage." >&2
    echo "Fix: Use the existing Scout wrapper in lib/scout/ or extend it." >&2
    exit 2
  fi
fi

exit 0
