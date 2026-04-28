---
name: scout-tool-add
description: Use when editing lib/scout/tools.ts to ensure the 3 coordinated edits required for a new Scout tool are completed (definition, implementation, doc). Triggered when tools.ts is being modified.
---

# Scout Tool Add — 3-File Coordination

Adding a Scout tool requires **three coordinated edits**. Missing any one creates a broken tool.

## Required Files

| #   | File                    | What to add                                   |
| --- | ----------------------- | --------------------------------------------- |
| 1   | `lib/scout/tools.ts`    | Tool schema (name, description, input_schema) |
| 2   | `lib/scout/executor.ts` | Case handler in the tool executor switch      |
| 3   | `docs/scout-tools.md`   | Entry in the appropriate tool catalog table   |

## When This Fires

When you are editing `lib/scout/tools.ts` (adding, removing, or renaming a tool).

## Verification Steps

After editing `lib/scout/tools.ts`:

1. **Check executor.ts:** Does `lib/scout/executor.ts` have a matching `case "tool_name"` for every tool defined in tools.ts?
2. **Check docs:** Does `docs/scout-tools.md` list the tool with correct input/output/notes?
3. **Name consistency:** Is the tool name identical across all three files?

## Output Format

```
Scout Tool Coordination Check:
  tools.ts:      [tool_name added/modified/removed]
  executor.ts:   [pass — handler exists] / [MISSING — add case handler]
  scout-tools.md: [pass — documented] / [MISSING — add to catalog]
```

If any file is MISSING, complete the edit before moving on.

## Reference

See `docs/scout-tools.md` § "How to add a new tool" for the full recipe.
