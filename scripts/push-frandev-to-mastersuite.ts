/**
 * Push FranDev (Supabase) data INTO the MasterSuite dev `frandev_*` tables.
 *
 * This is the outbound counterpart to scripts/run-ms-sync.ts. MasterSuite dev
 * refreshes from prod nightly, so schedule this AFTER that refresh; it fully
 * re-pushes every run (idempotent upsert by primary key).
 *
 * Usage:
 *   npx tsx scripts/push-frandev-to-mastersuite.ts --dry-run
 *   npx tsx scripts/push-frandev-to-mastersuite.ts --dry-run --tables=contacts,calls --limit=50
 *   npx tsx scripts/push-frandev-to-mastersuite.ts            # real push (needs write creds)
 *
 * Which database it writes to is `MASTERSUITE_WRITE_TARGET` (dev | prod) — see
 * lib/mastersuite/write-client.ts. Production is authorized for `frandev_*`
 * only and requires MASTERSUITE_PROD_DB_* explicitly (no fallback).
 *
 * --dry-run validates read+map+SQL generation WITHOUT writing. It needs no
 * write creds: it reads the frandev_ schema from the read-only prod DB, so it
 * proves the mapping against production end-to-end before any grant exists.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });

const { register } = require("tsconfig-paths");
const { resolve } = require("path");
const tsconfig = require(resolve(__dirname, "../tsconfig.json"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const tablesArg = args.find((a) => a.startsWith("--tables="));
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const tables = tablesArg
    ? tablesArg
        .split("=")[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 0;

  const { pushFrandev } = require("@/lib/mastersuite/push-frandev");
  const {
    getMasterSuiteWritePool,
    isWriteConfigured,
    endMasterSuiteWritePool,
    getWriteTarget,
  } = require("@/lib/mastersuite/write-client");
  const { getMasterSuitePool } = require("@/lib/mastersuite/client");

  console.log(`=== FranDev -> MasterSuite push (${dryRun ? "DRY RUN" : "LIVE"}) ===`);
  console.log("Time:", new Date().toISOString());

  let schemaPool;
  let writePool = null;
  if (dryRun) {
    // Read frandev_ schema from the read-only prod DB (dev mirrors prod).
    schemaPool = getMasterSuitePool();
    console.log("Schema source: read-only PRODUCTION (dry run, no writes)\n");
  } else {
    if (!isWriteConfigured()) {
      const t = getWriteTarget();
      const prefix = t === "prod" ? "MASTERSUITE_PROD_DB_*" : "MASTERSUITE_DEV_DB_*";
      console.error(`${prefix} credentials are not set. Cannot do a live push to ${t}.`);
      console.error(`Set ${prefix.replace("*", "")}HOST / _PORT / _USER / _PASSWORD / _NAME, or use --dry-run.`);
      process.exit(1);
    }
    schemaPool = getMasterSuiteWritePool();
    writePool = schemaPool; // target DB is both schema source and write target
    const target = getWriteTarget();
    console.log(`Target: MasterSuite ${target.toUpperCase()} database`);
    if (target === "prod") {
      console.log("*** WRITING TO PRODUCTION (frandev_ tables only) ***");
    }
    console.log("");
  }

  const summary = await pushFrandev({
    dryRun,
    tables,
    limit,
    schemaPool,
    writePool,
    log: (m: string) => console.log(m),
  });

  console.log("\n=== Summary ===");
  console.log(`Tables planned:      ${summary.totalTables}`);
  console.log(`Tables with rows:    ${summary.pushedTables}`);
  console.log(`Source rows read:    ${summary.totalSourceRows}`);
  console.log(`Rows ${dryRun ? "would push" : "pushed"}:     ${summary.totalPushedRows}`);
  console.log(`Rows skipped (bad):  ${summary.totalSkippedRows}`);
  console.log(`Tables with errors:  ${summary.tablesWithErrors}`);

  const errored = summary.results.filter((r: { error?: string }) => r.error);
  if (errored.length > 0) {
    console.log("\n--- Errors ---");
    errored.forEach((r: { frandevTable: string; error?: string }) => console.log(`  ${r.frandevTable}: ${r.error}`));
  }
  const noSource = summary.results.filter((r: { skipped?: string }) => r.skipped === "no_supabase_source");
  if (noSource.length > 0) {
    console.log(
      `\nNote: ${noSource.length} frandev_ table(s) had no Supabase source (expected for any not owned by FranDev).`
    );
  }

  try {
    await getMasterSuitePool().end();
  } catch {}
  try {
    await endMasterSuiteWritePool();
  } catch {}

  process.exit(errored.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
