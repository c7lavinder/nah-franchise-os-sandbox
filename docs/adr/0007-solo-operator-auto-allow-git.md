# ADR 0007: Solo operator auto-allow git, hard-block data destruction only

## Status
Accepted

## Context
Claude Code's git-guardrails hook was blocking normal git operations during the auth retrofit. The strict hybrid-permissions model created friction for a solo operator.

## Decision
Auto-allow all git operations via .claude/settings.json permissions. Hard-block only via the hook script: filesystem destruction at system root, SQL data destruction (DROP/TRUNCATE), and non-origin remote targets. Regular operations all pass through.

## Consequences
- Claude Code can do all git work autonomously
- Destructive operations still blocked at the hook level
- Less friction for solo operator workflow
- When team grows, add permissions.ask layer for collaborative operations
