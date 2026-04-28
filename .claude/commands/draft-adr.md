Create a new Architecture Decision Record in docs/adr/.

Steps:

1. List existing files in docs/adr/ to find the highest numbered ADR
2. Increment by 1 (zero-padded to 4 digits) for the new file number
3. Ask for: title, context summary, and decision summary (unless all provided as arguments)
4. Convert title to kebab-case for the filename
5. Create the file with this template:

```markdown
# ADR-NNNN: [Title]

## Status

Accepted — [YYYY-MM-DD]

## Context

[Context from user]

## Decision

[Decision from user]

## Consequences

- [Draft reasonable consequences, ask user to confirm or edit]
```

If the user provides all info in their message, create immediately without extra questions.
Never overwrite an existing ADR file.
