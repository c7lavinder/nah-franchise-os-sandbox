---
name: ghl-boundary-check
description: Use when editing files in lib/ or app/api/ to enforce GHL boundary (all GHL API calls must go through lib/ghl/client.ts) and Scout boundary (all Anthropic SDK calls must go through lib/scout/). Also enforced via PreToolUse(Edit) hook.
---

# GHL & Scout Boundary Check

Enforces two architectural boundaries established in ADR-0001 and CLAUDE.md:

1. **GHL boundary:** All GoHighLevel API calls must go through `lib/ghl/client.ts`
2. **Scout boundary:** All Anthropic SDK calls must go through `lib/scout/`

## What Gets Flagged

### GHL violations

Any file OUTSIDE `lib/ghl/client.ts` that introduces:

- `fetch()` calls to URLs containing `leadconnectorhq.com` or `services.leadconnectorhq.com`
- Direct `https://services.leadconnectorhq.com` string literals
- New GHL API endpoint URLs

**Allowed exception:** `lib/ghl/client.ts` itself (the wrapper)

### Scout violations

Any file OUTSIDE `lib/scout/` that introduces:

- `import Anthropic` or `from "@anthropic-ai/sdk"`
- `new Anthropic(` constructor calls
- Direct `anthropic.messages.create` calls

**Allowed exception:** Files within `lib/scout/` directory

## When Flagged

Output:

```
BOUNDARY VIOLATION DETECTED
─────────────────────────
[GHL/Scout]: [description of what was found]
File: [file path]
Rule: [GHL calls must go through lib/ghl/client.ts / Anthropic calls must go through lib/scout/]
Fix: Use the existing wrapper or extend it.
```

Do NOT proceed with the edit until the violation is resolved by:

1. Moving the call into the appropriate wrapper, OR
2. Extending the wrapper to support the new use case
