Review SQL migration files in the current changes. Run `git diff main...HEAD -- '*.sql'` (or `git diff --cached -- '*.sql'` if on main) to find migration changes, then evaluate each item below.

If no SQL files changed, report "No migration files in current changes" and stop.

## Review Checklist

For each changed .sql file:

### Idempotency

- Uses `IF NOT EXISTS` for CREATE TABLE/INDEX?
- Uses `IF EXISTS` for DROP operations?
- Uses `CREATE OR REPLACE` for functions/views?

### RLS Policies

- New tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`?
- At least one RLS policy defined per new table?
- If RLS not applicable, documented why?

### Indexes on FK Columns

- Foreign key columns have corresponding indexes?
- `CREATE INDEX CONCURRENTLY` used where appropriate for large tables?

### FK Integrity

- `REFERENCES` clauses point to existing tables?
- `ON DELETE` behavior specified (CASCADE, SET NULL, RESTRICT)?

### No Breaking ALTERs

- No `DROP COLUMN` on columns that may have data?
- No `ALTER TYPE` that could fail on existing data?
- No `NOT NULL` added without `DEFAULT` or backfill?

### Rollback Path

- Comment block or companion section describing how to undo?
- Down-migration documented?

## Output Format

```
Migration Review
════════════════
File: [filename]
  [pass/WARN/FAIL] Idempotency
  [pass/WARN/FAIL] RLS policies
  [pass/WARN/FAIL] FK indexes
  [pass/WARN/FAIL] FK integrity
  [pass/WARN/FAIL] No breaking ALTERs
  [pass/WARN/FAIL] Rollback documented
════════════════
  [SAFE TO APPLY / ISSUES FOUND — see details above]
```

For any WARN or FAIL, include the specific SQL statement and line number.
