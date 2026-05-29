# ADR 0003: Draft-Review-Confirm pattern

## Status
Accepted

## Context
Scout is an AI that can take real actions in the CRM. An autonomous AI acting without oversight is unacceptable for franchise sales where relationships and compliance matter.

## Decision
Every Scout action follows Draft-Review-Confirm (DRC): Scout drafts the action, presents it for review, the human edits if needed and confirms, then Scout executes. No action is ever taken without explicit human confirmation.

## Consequences
- All Scout tools that produce side effects are "draft_*" tools
- Frontend must show a confirmation UI for every drafted action
- Action logs capture both the draft and the final version
- Customer-facing sends also follow the Phase 4 send safety contract in [ADR 0004](./0004-send-safety-and-agent-control-plane.md)
- Slightly slower than autonomous execution, but dramatically safer
