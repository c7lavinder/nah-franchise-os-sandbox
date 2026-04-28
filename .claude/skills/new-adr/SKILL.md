---
name: new-adr
description: Use when user wants to document a new architectural decision, says 'let's ADR this', or types /draft-adr. Creates a new ADR file in docs/adr/ with the next available number.
---

# New ADR

Create a new Architecture Decision Record in `docs/adr/`.

## Steps

1. List existing files in `docs/adr/` to find the highest numbered ADR
2. Increment by 1 to get the next number (zero-padded to 4 digits)
3. Ask the user for:
   - **Title** (will become the kebab-case slug)
   - **Context** — what is the situation that requires a decision?
   - **Decision** — what was decided?
4. Create the file using the template below

## Template

File name: `docs/adr/NNNN-kebab-slug.md`

```markdown
# ADR-NNNN: [Title]

## Status

Accepted — [YYYY-MM-DD]

## Context

[Context summary from user]

## Decision

[Decision summary from user]

## Consequences

- [List consequences — both positive and negative]
- [Ask user if they want to add specific consequences, or draft reasonable ones]
```

## Rules

- Always auto-detect the next number from existing files
- Convert title to kebab-case for the filename
- Never overwrite an existing ADR
- If the user provides all info upfront, create immediately without extra questions
