# ADR 0010: No sprints directory

## Status
Accepted

## Context
Enterprise projects often have a /sprints/ directory with sprint planning docs.

## Decision
No /sprints/ directory. Roadmap lives in docs/master-plan.md checkboxes. Session state lives in handoff.md. Sprint logs were deleted in Session A.

## Consequences
- Less file clutter
- Roadmap is always in one place (master-plan.md)
- Session-by-session progress tracked via handoff.md + git history
- If sprints become needed later, add them then
