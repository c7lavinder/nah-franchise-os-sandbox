# ADR 0006: Feature branch workflow

## Status
Accepted

## Context
Solo operator (Corey + Claude Code). Need a workflow that's safe but not heavyweight.

## Decision
Feature branches for multi-file changes. Commit to main directly for single-file fixes. No PR review required until CI gates land in Session B. Branch naming: kebab-case prefixed by type.

## Consequences
- Vercel auto-deploys from main in ~3 minutes
- Feature branches protect main during multi-commit work
- Solo operator handles full git lifecycle
- CI gates (Session B) will add automated checks
