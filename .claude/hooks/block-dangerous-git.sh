#!/bin/bash

# Hard-block layer for the hybrid permissions architecture (Session B).
# Catches truly destructive commands; lets soft cases (plain `git push`,
# `git merge`, etc.) fall through to permissions.ask in .claude/settings.json.
#
# Hook contract: exit 2 = block before permission rules are evaluated.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

DANGEROUS_PATTERNS=(
  # Force push variants
  "git push.*--force"
  "--force.*git push"
  "git push.*-f($|[[:space:]])"
  "-f[[:space:]].*git push"
  "--force-with-lease"
  # Hard reset
  "git reset --hard"
  "reset --hard"
  # Working-tree wipe
  "git clean -fd"
  "git clean -f"
  "git checkout \."
  "git restore \."
  # Branch deletion (uppercase -D = force delete)
  "git branch -D"
  # Recursive force remove
  "rm -rf"
  "rm -fr"
  "rm -Rf"
  "rm -fR"
  "rm.*--recursive.*--force"
  "rm.*--force.*--recursive"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE -e "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'. Hard-block layer denies destructive operations even when the agent has permission to run regular variants. The user has prevented you from doing this." >&2
    exit 2
  fi
done

exit 0
