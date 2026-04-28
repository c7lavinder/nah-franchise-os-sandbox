---
name: migration-safety-check
description: Use when editing or creating any .sql file under supabase/migrations/, lib/*/schema.sql, or any file matching *migration*.ts. Forces a checklist before write. Also triggered automatically via PreToolUse(Edit) hook on *.sql files.
---

# Migration Safety Check

Before writing or editing any SQL migration file, you MUST complete this checklist. Do not proceed with the edit until every item is addressed.

## Checklist

Review the SQL content and answer each item:

1. **Idempotent?** Does the migration use `IF NOT EXISTS`, `IF EXISTS`, `CREATE OR REPLACE`, or other guard clauses so it can run safely more than once?
   - If not: add guard clauses before writing.

2. **Rollback path documented?** Is there a comment or companion section describing how to undo this migration?
   - If not: add a `-- Rollback:` comment block at the top of the file.

3. **RLS policies defined?** If creating new tables, are Row-Level Security policies defined?
   - If not: add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and at least one policy, or document why RLS is not needed.

4. **NOT NULL defaults?** Do any new `NOT NULL` columns have a `DEFAULT` value or a backfill strategy?
   - If not: add defaults or document the backfill plan.

5. **Large table risk?** Does this migration touch a table with >10k rows (ALTER, index creation, constraint changes)?
   - If yes: flag the risk and consider `CONCURRENTLY` for index creation or batched updates.

## Output Format

After reviewing, output the checklist results before proceeding:

```
Migration Safety Check:
  (1) Idempotent: [pass] / [WARN: needs guard clauses]
  (2) Rollback: [pass] / [WARN: no rollback documented]
  (3) RLS: [pass] / [N/A — no new tables] / [WARN: missing RLS]
  (4) NOT NULL defaults: [pass] / [N/A] / [WARN: missing defaults]
  (5) Large table: [no risk] / [WARN: table X may have >10k rows]
```

If any item shows WARN, address it before writing the file. Do not skip warnings.
