#!/bin/bash

# Hard-block layer for the solo-workflow permissions architecture.
# Philosophy: git mistakes are recoverable (Vercel keeps deploy history,
# refs survive in reflog). Data destruction and root-fs wipes are not.
# Block only what cannot be undone; let the agent do all git work freely.
#
# Hook contract: exit 2 = block before permission rules are evaluated.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# ---------------------------------------------------------------------------
# 1. Filesystem destruction at system root, home, or env-var-expanded paths.
#    Project-relative `rm -rf node_modules` etc. remains allowed.
# ---------------------------------------------------------------------------
FS_PATTERNS=(
  'rm[[:space:]]+-[rRfFv]*[rRfF][rRfFv]*[[:space:]]+/'
  'rm[[:space:]]+-[rRfFv]*[rRfF][rRfFv]*[[:space:]]+~'
  'rm[[:space:]]+-[rRfFv]*[rRfF][rRfFv]*[[:space:]]+\$HOME'
  'rm[[:space:]]+-[rRfFv]*[rRfF][rRfFv]*[[:space:]]+\*'
  'rm[[:space:]]+--recursive[[:space:]]+--force[[:space:]]+/'
  'rm[[:space:]]+--force[[:space:]]+--recursive[[:space:]]+/'
)

for pattern in "${FS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE -e "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches catastrophic filesystem pattern '$pattern'. Root/home-level rm is irreversible. The user has prevented you from doing this." >&2
    exit 2
  fi
done

# ---------------------------------------------------------------------------
# 2. Supabase data destruction. Schema drops and TRUNCATEs are irreversible
#    in production. Migrations should go through the supabase migration flow,
#    not ad-hoc psql calls.
# ---------------------------------------------------------------------------
SQL_PATTERNS=(
  'DROP[[:space:]]+DATABASE'
  'DROP[[:space:]]+TABLE'
  'DROP[[:space:]]+SCHEMA'
  'TRUNCATE[[:space:]]+(TABLE[[:space:]]+)?[a-zA-Z_"]'
)

for pattern in "${SQL_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiE -e "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches SQL data-destruction pattern '$pattern'. Schema drops and TRUNCATEs cannot be undone — use a Supabase migration instead. The user has prevented you from doing this." >&2
    exit 2
  fi
done

# ---------------------------------------------------------------------------
# 3. git push to anything other than 'origin'. Anti-mistake: prevents
#    accidentally pushing to upstream/fork/wrong-account remotes. Plain
#    `git push` and `git push origin ...` (with any flags, including --force)
#    pass through.
# ---------------------------------------------------------------------------
if echo "$COMMAND" | grep -qE '\bgit[[:space:]]+push\b'; then
  found_push=0
  remote=""
  for word in $COMMAND; do
    if [[ $found_push -eq 1 ]]; then
      case "$word" in
        -*) continue ;;
        *) remote="$word"; break ;;
      esac
    fi
    if [[ "$word" == "push" ]]; then
      found_push=1
    fi
  done

  if [[ -n "$remote" && "$remote" != "origin" ]]; then
    echo "BLOCKED: 'git push $remote ...' targets a non-origin remote. Solo workflow only pushes to origin. The user has prevented you from doing this." >&2
    exit 2
  fi
fi

exit 0
