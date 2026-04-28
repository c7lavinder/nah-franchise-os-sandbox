#!/bin/bash

# PreToolUse(Edit) hook: surfaces migration safety checklist when editing SQL files.
# Exit 0 = allow edit but show reminder. Only fires for .sql files.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only fire for .sql files
if [[ -z "$FILE_PATH" ]] || [[ "$FILE_PATH" != *.sql ]]; then
  exit 0
fi

echo "MIGRATION SAFETY CHECK — Review before writing SQL:" >&2
echo "  (1) Idempotent? (IF NOT EXISTS / guard clauses)" >&2
echo "  (2) Rollback path documented?" >&2
echo "  (3) RLS policies defined for new tables?" >&2
echo "  (4) NOT NULL columns have DEFAULT or backfill?" >&2
echo "  (5) Large table risk? (>10k rows)" >&2
echo "Address each item in your response before proceeding." >&2

exit 0
