import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getServiceSupabase } from "./supabase";

/**
 * OUTBOUND sync: NAH OS (Supabase, source of truth for FranDev) -> MasterSuite
 * dev MariaDB `frandev_*` tables.
 *
 * This is the mirror image of the inbound `sync-*` files. It exists so the
 * pages being rebuilt inside MasterSuite have real FranDev data each working
 * day. MasterSuite dev refreshes from prod nightly, so this should run AFTER
 * that refresh; it fully re-pushes (idempotent upsert by primary key).
 *
 * Schema-driven, not hand-mapped: the 114 `frandev_` tables mirror our
 * Supabase tables 1:1, but use .NET PascalCase column names while Supabase is
 * snake_case. We resolve the mapping at runtime from the live `frandev_` schema
 * so new columns flow through without code changes.
 */

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

/** `GhlContactId` -> `ghl_contact_id`, `ReadAiSessionId` -> `read_ai_session_id`. */
export function pascalToSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/**
 * Irregular `frandev_` table -> Supabase table overrides (Latin plurals the
 * generic pluralizer can't reach). Everything else resolves by the standard
 * "strip prefix + pluralize last word" rule.
 */
const TABLE_OVERRIDES: Record<string, string> = {
  frandev_contact_profile_datum: "contact_profile_data",
  frandev_contact_related_person: "contact_related_people",
  frandev_contact_zorakle_datum: "contact_zorakle_data",
  frandev_rubric_criterion: "rubric_criteria",
};

/** Best-effort plural candidates for a singular `frandev_` base name. */
function pluralCandidates(base: string): string[] {
  const parts = base.split("_");
  const last = parts[parts.length - 1];
  const pLast = last.endsWith("y")
    ? last.slice(0, -1) + "ies"
    : /(?:s|x|z|ch|sh)$/.test(last)
      ? last + "es"
      : last + "s";
  const withPluralLast = [...parts.slice(0, -1), pLast].join("_");
  return [...new Set([base, base + "s", base + "es", withPluralLast])];
}

/** Resolve the Supabase source table for a `frandev_` table, or null. */
export function resolveSupabaseTable(frandevTable: string, supabaseTables: Set<string>): string | null {
  if (TABLE_OVERRIDES[frandevTable]) return TABLE_OVERRIDES[frandevTable];
  const base = frandevTable.replace(/^frandev_/, "");
  return pluralCandidates(base).find((c) => supabaseTables.has(c)) ?? null;
}

// ---------------------------------------------------------------------------
// Value coercion (Postgres/Supabase JSON -> MySQL parameter)
// ---------------------------------------------------------------------------

type Primitive = string | number | null;

/** Character cap for varchar(N)/char(N) columns; null for unbounded types. */
function charLimit(destType: string): number | null {
  const m = destType.match(/^(?:var)?char\((\d+)\)/i);
  return m ? parseInt(m[1], 10) : null;
}

function coerceValue(value: unknown, destType: string): Primitive {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "object") {
    // jsonb arrays/objects -> JSON text, truncated if the dest column is narrow.
    const json = JSON.stringify(value);
    const lim = charLimit(destType);
    return lim && json.length > lim ? json.slice(0, lim) : json;
  }
  if (typeof value === "string") {
    const lim = charLimit(destType);
    const str = lim && value.length > lim ? value.slice(0, lim) : value;
    // datetime/timestamp columns: normalize any ISO-ish value to
    // 'YYYY-MM-DD HH:MM:SS', dropping fractional seconds AND timezone offsets
    // (Supabase returns timestamptz like '2022-09-26 06:22:18+00:00').
    if (/^(datetime|timestamp)/i.test(destType)) {
      const dt = str.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
      if (dt) return `${dt[1]} ${dt[2]}`;
      const dateOnly = str.match(/^(\d{4}-\d{2}-\d{2})$/);
      if (dateOnly) return `${dateOnly[1]} 00:00:00`;
      return str;
    }
    // date columns: keep only the calendar date.
    if (/^date$/i.test(destType)) {
      const d = str.match(/^(\d{4}-\d{2}-\d{2})/);
      if (d) return d[1];
    }
    return str;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Schema introspection
// ---------------------------------------------------------------------------

interface DestColumn {
  name: string; // PascalCase frandev column
  type: string; // MySQL column type, lowercased
  isPrimary: boolean;
  required: boolean; // NOT NULL with no default and not auto-generated
}

async function getFrandevTables(schemaPool: Pool): Promise<string[]> {
  const [rows] = await schemaPool.query<RowDataPacket[]>("SHOW TABLES LIKE 'frandev\\_%'");
  return rows.map((r) => Object.values(r)[0] as string);
}

async function getDestColumns(schemaPool: Pool, table: string): Promise<DestColumn[]> {
  const [rows] = await schemaPool.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${table}\``);
  return rows.map((r) => {
    const extra = String(r.Extra ?? "").toLowerCase();
    const generated = extra.includes("auto_increment") || extra.includes("default_generated");
    return {
      name: r.Field as string,
      type: String(r.Type).toLowerCase(),
      isPrimary: r.Key === "PRI",
      // A column we MUST supply: NOT NULL, no default, not auto-generated.
      required: r.Null === "NO" && r.Default === null && !generated,
    };
  });
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface PushOptions {
  /** When true, do everything except execute the INSERTs (no write creds needed). */
  dryRun?: boolean;
  /** Restrict to these tables (accepts frandev_ or Supabase names). Empty = all. */
  tables?: string[];
  /** Cap rows read per table (testing aid). 0 = no cap. */
  limit?: number;
  /** Rows per bulk INSERT. */
  batchSize?: number;
  /** Pool used for SHOW TABLES/COLUMNS. Real runs pass the dev write pool. */
  schemaPool: Pool;
  /** Pool used for INSERTs. Required unless dryRun. */
  writePool?: Pool | null;
  /** Optional progress logger. */
  log?: (msg: string) => void;
}

export interface TablePushResult {
  frandevTable: string;
  supabaseTable: string | null;
  sourceRows: number;
  pushedRows: number;
  skippedRows: number; // rows that failed individually and were skipped
  mappedColumns: number;
  unmappedDestColumns: string[]; // frandev cols with no Supabase source
  droppedSourceColumns: string[]; // Supabase cols with no frandev dest
  skipped?: string;
  error?: string;
}

export interface PushSummary {
  dryRun: boolean;
  totalTables: number;
  pushedTables: number;
  totalSourceRows: number;
  totalPushedRows: number;
  totalSkippedRows: number;
  tablesWithErrors: number;
  results: TablePushResult[];
}

const SUPABASE_PAGE = 1000; // Supabase caps a single select at 1000 rows.

async function fetchAllRows(table: string, limit: number): Promise<Record<string, unknown>[]> {
  const sb = getServiceSupabase();
  const out: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const pageSize = limit > 0 ? Math.min(SUPABASE_PAGE, limit - out.length) : SUPABASE_PAGE;
    if (pageSize <= 0) break;
    const { data, error } = await sb
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase read failed for ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += data.length;
  }
  return out;
}

/**
 * Build the dest-column -> source-key mapping for one table from a sample row.
 * For each frandev column, prefer an exact key (Supabase columns that are
 * already PascalCase, e.g. `TerritorySlug`), then fall back to the snake_case
 * equivalent.
 */
function buildColumnMap(
  destColumns: DestColumn[],
  sampleRow: Record<string, unknown>
): { mapped: { dest: DestColumn; sourceKey: string }[]; unmappedDest: string[] } {
  const sourceKeys = new Set(Object.keys(sampleRow));
  const mapped: { dest: DestColumn; sourceKey: string }[] = [];
  const unmappedDest: string[] = [];
  for (const dest of destColumns) {
    const snake = pascalToSnake(dest.name);
    const sourceKey = sourceKeys.has(dest.name) ? dest.name : sourceKeys.has(snake) ? snake : null;
    if (sourceKey) mapped.push({ dest, sourceKey });
    else unmappedDest.push(dest.name);
  }
  return { mapped, unmappedDest };
}

// Keep bulk INSERT packets well under MySQL's max_allowed_packet so a few fat
// JSON/transcript rows can't blow the connection.
const MAX_BATCH_BYTES = 512_000;
const MAX_BATCH_ROWS = 500;
// Floor for split-retry: a failing chunk this size or smaller is skipped
// wholesale rather than probed row-by-row. Bounds round-trips to a remote DB so
// a fully-failing large table can't turn into thousands of one-row inserts.
const MIN_SPLIT_ROWS = 25;

/** Rough serialized size of one value row, for byte-budgeting. */
function rowBytes(values: Primitive[]): number {
  let n = 0;
  for (const v of values) n += typeof v === "string" ? v.length : 8;
  return n;
}

/**
 * Insert a batch, halving and retrying on error so one bad row can't sink a
 * whole batch — but only down to MIN_SPLIT_ROWS, below which a failing chunk is
 * skipped wholesale (counted, never thrown). Returns inserted/skipped counts.
 */
async function insertBatch(
  conn: PoolConnection,
  sql: string,
  values: Primitive[][]
): Promise<{ inserted: number; skipped: number }> {
  if (values.length === 0) return { inserted: 0, skipped: 0 };
  try {
    await conn.query(sql, [values]);
    return { inserted: values.length, skipped: 0 };
  } catch {
    if (values.length <= MIN_SPLIT_ROWS) return { inserted: 0, skipped: values.length };
    const mid = Math.floor(values.length / 2);
    const a = await insertBatch(conn, sql, values.slice(0, mid));
    const b = await insertBatch(conn, sql, values.slice(mid));
    return { inserted: a.inserted + b.inserted, skipped: a.skipped + b.skipped };
  }
}

async function pushTable(
  frandevTable: string,
  supabaseTable: string,
  opts: PushOptions,
  writeConn: PoolConnection | null
): Promise<TablePushResult> {
  const result: TablePushResult = {
    frandevTable,
    supabaseTable,
    sourceRows: 0,
    pushedRows: 0,
    skippedRows: 0,
    mappedColumns: 0,
    unmappedDestColumns: [],
    droppedSourceColumns: [],
  };

  const destColumns = await getDestColumns(opts.schemaPool, frandevTable);
  const rows = await fetchAllRows(supabaseTable, opts.limit ?? 0);
  result.sourceRows = rows.length;
  if (rows.length === 0) {
    result.skipped = "no_source_rows";
    return result;
  }

  const { mapped, unmappedDest } = buildColumnMap(destColumns, rows[0]);
  result.mappedColumns = mapped.length;
  result.unmappedDestColumns = unmappedDest;
  const mappedSourceKeys = new Set(mapped.map((m) => m.sourceKey));
  result.droppedSourceColumns = Object.keys(rows[0]).filter((k) => !mappedSourceKeys.has(k));

  if (mapped.length === 0) {
    result.skipped = "no_column_overlap";
    return result;
  }

  // Pre-skip tables we can't possibly satisfy: a NOT NULL, no-default frandev
  // column with no FranDev source would fail on every row. Report it instead of
  // probing thousands of rows to discover the same thing. (Fix is frandev-side:
  // make the column nullable, or give it a default.)
  const mappedNames = new Set(mapped.map((m) => m.dest.name));
  const missingRequired = destColumns.filter((c) => c.required && !mappedNames.has(c.name)).map((c) => c.name);
  if (missingRequired.length > 0) {
    result.skipped = `missing_required:${missingRequired.join(",")}`;
    return result;
  }

  const destNames = mapped.map((m) => `\`${m.dest.name}\``);
  const nonPkCols = mapped.filter((m) => !m.dest.isPrimary);
  const updateClause = (nonPkCols.length > 0 ? nonPkCols : mapped)
    .map((m) => `\`${m.dest.name}\`=VALUES(\`${m.dest.name}\`)`)
    .join(", ");
  const sql =
    `INSERT INTO \`${frandevTable}\` (${destNames.join(", ")}) VALUES ? ` + `ON DUPLICATE KEY UPDATE ${updateClause}`;

  // Build byte-budgeted batches so large rows don't exceed max_allowed_packet.
  let batch: Primitive[][] = [];
  let batchBytes = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    if (!opts.dryRun) {
      if (!writeConn) throw new Error("writeConn required for a non-dry-run push");
      const { inserted, skipped } = await insertBatch(writeConn, sql, batch);
      result.pushedRows += inserted;
      result.skippedRows += skipped;
    } else {
      result.pushedRows += batch.length;
    }
    batch = [];
    batchBytes = 0;
  };

  for (const row of rows) {
    const values = mapped.map((m) => coerceValue(row[m.sourceKey], m.dest.type));
    const bytes = rowBytes(values);
    if (batch.length >= MAX_BATCH_ROWS || (batch.length > 0 && batchBytes + bytes > MAX_BATCH_BYTES)) {
      await flush();
    }
    batch.push(values);
    batchBytes += bytes;
  }
  await flush();
  return result;
}

export async function pushFrandev(opts: PushOptions): Promise<PushSummary> {
  const log = opts.log ?? (() => {});
  const supabaseTables = new Set(SUPABASE_TABLES);
  const allFrandev = await getFrandevTables(opts.schemaPool);

  // Resolve and (optionally) filter the table list.
  const filter = (opts.tables ?? []).map((t) => t.toLowerCase());
  const plan: { frandev: string; supabase: string }[] = [];
  const results: TablePushResult[] = [];
  for (const fd of allFrandev) {
    const sb = resolveSupabaseTable(fd, supabaseTables);
    if (!sb) {
      results.push({
        frandevTable: fd,
        supabaseTable: null,
        sourceRows: 0,
        pushedRows: 0,
        skippedRows: 0,
        mappedColumns: 0,
        unmappedDestColumns: [],
        droppedSourceColumns: [],
        skipped: "no_supabase_source",
      });
      continue;
    }
    if (filter.length > 0 && !filter.includes(fd.toLowerCase()) && !filter.includes(sb.toLowerCase())) {
      continue;
    }
    plan.push({ frandev: fd, supabase: sb });
  }

  // One dedicated connection for the whole load, with referential-integrity
  // checks off. The frandev_ tables have FK and circular dependencies that make
  // alphabetical insertion order impossible; the data itself is internally
  // consistent (it came from Postgres), so we just lift ordering constraints.
  let writeConn: PoolConnection | null = null;
  if (!opts.dryRun) {
    if (!opts.writePool) throw new Error("writePool required for a non-dry-run push");
    writeConn = await opts.writePool.getConnection();
    await writeConn.query("SET FOREIGN_KEY_CHECKS = 0");
    await writeConn.query("SET UNIQUE_CHECKS = 0");
  }

  try {
    log(`${opts.dryRun ? "[dry-run] " : ""}pushing ${plan.length} table(s)`);
    for (const { frandev, supabase } of plan) {
      try {
        const r = await pushTable(frandev, supabase, opts, writeConn);
        results.push(r);
        const skip = r.skippedRows > 0 ? `, ${r.skippedRows} skipped` : "";
        log(
          `  ${frandev} <- ${supabase}: ${r.pushedRows}/${r.sourceRows} rows${skip}, ` +
            `${r.mappedColumns} cols${r.skipped ? ` (skipped: ${r.skipped})` : ""}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          frandevTable: frandev,
          supabaseTable: supabase,
          sourceRows: 0,
          pushedRows: 0,
          skippedRows: 0,
          mappedColumns: 0,
          unmappedDestColumns: [],
          droppedSourceColumns: [],
          error: message,
        });
        log(`  ${frandev} <- ${supabase}: ERROR ${message}`);
      }
    }
  } finally {
    if (writeConn) {
      await writeConn.query("SET FOREIGN_KEY_CHECKS = 1");
      await writeConn.query("SET UNIQUE_CHECKS = 1");
      writeConn.release();
    }
  }

  return {
    dryRun: Boolean(opts.dryRun),
    totalTables: plan.length,
    pushedTables: results.filter((r) => r.pushedRows > 0).length,
    totalSourceRows: results.reduce((a, r) => a + r.sourceRows, 0),
    totalPushedRows: results.reduce((a, r) => a + r.pushedRows, 0),
    totalSkippedRows: results.reduce((a, r) => a + r.skippedRows, 0),
    tablesWithErrors: results.filter((r) => r.error).length,
    results,
  };
}

/**
 * Known Supabase (public schema) table names, used to resolve `frandev_`
 * sources without an extra information_schema round-trip. Keep in sync with
 * `supabase/migrations/`.
 */
export const SUPABASE_TABLES: string[] = [
  "agent_actions",
  "agent_approvals",
  "agent_run_events",
  "agent_runs",
  "ai_api_activity",
  "ai_api_tokens",
  "app_settings",
  "bug_reports",
  "call_action_feedback",
  "call_action_items",
  "call_coaching",
  "call_data_extractions",
  "call_grades",
  "call_journeys",
  "call_logs",
  "call_participants",
  "call_review_packages",
  "call_territories",
  "call_transcripts",
  "call_types",
  "calls",
  "candidate_intelligence",
  "candidate_score_history",
  "coach_assignments",
  "commitments",
  "compliance_tracking",
  "contact_activity_messages",
  "contact_briefs",
  "contact_emails",
  "contact_journals",
  "contact_pipeline_state",
  "contact_profile_data",
  "contact_profile_fields",
  "contact_related_people",
  "contact_scores",
  "contact_sub_task_logs",
  "contact_team_members",
  "contact_zorakle_data",
  "contacts",
  "cron_job_log",
  "data_update_suggestions",
  "embeddings",
  "eos_contact_goals",
  "eos_contact_habits",
  "eos_contact_issues",
  "eos_contact_todos",
  "eos_territory_budgets",
  "eos_territory_goals",
  "eos_territory_habits",
  "eos_territory_issues",
  "eos_territory_lead_channels",
  "eos_territory_rocks",
  "eos_territory_scorecard",
  "eos_territory_todos",
  "flagged_responses",
  "franchise_owners",
  "franchisee_performance",
  "ghl_action_drafts",
  "ghl_appointments",
  "ghl_custom_fields",
  "ghl_pipeline_stages",
  "ghl_sync_queue",
  "ghl_workflows",
  "inactivity_alerts",
  "integration_logs",
  "journey_briefs",
  "journey_contacts",
  "journey_documents",
  "journey_pipeline_state",
  "journeys",
  "kb_gap_signals",
  "knowledge_documents",
  "lead_sources",
  "lead_sub_sources",
  "llm_call_logs",
  "market_signals",
  "notifications",
  "objection_registry",
  "pipeline_app_settings",
  "pipeline_stage_history",
  "pipeline_stages",
  "pipeline_sub_tasks",
  "pipelines",
  "read_ai_sessions",
  "read_ai_webhook_keys",
  "rep_journals",
  "rubric_criteria",
  "rubric_review_suggestions",
  "rubrics",
  "scout_action_logs",
  "scout_performance_reports",
  "scout_retrieval_logs",
  "scout_user_memory",
  "sessions",
  "sms_conversation_reads",
  "sms_messages",
  "suggestion_feedback",
  "sync_watermarks",
  "system_logs",
  "tasks",
  "territories",
  "territory_briefs",
  "territory_candidates",
  "territory_grades",
  "territory_market_data",
  "territory_owners",
  "territory_profile",
  "territory_stakeholders",
  "transcript_jobs",
  "user_email_aliases",
  "user_memory",
  "users",
  "work_queue_items",
  "workflow_ab_tests",
  "workflow_approvals",
  "workflow_enrollments",
  "workflow_step_logs",
  "workflow_steps",
  "workflow_versions",
  "workflows",
  "zorakle_assessments",
  "zorakle_profiles",
];
