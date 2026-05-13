/**
 * Run all MasterSuite syncs — used by GitHub Actions cron.
 * Calls the same sync functions the Vercel cron routes use.
 *
 * Usage: npx tsx scripts/run-ms-sync.ts
 */

// Register path aliases for Next.js imports
const { register } = require("tsconfig-paths");
const { resolve } = require("path");
const tsconfig = require(resolve(__dirname, "../tsconfig.json"));

register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

async function main() {
  const start = Date.now();
  console.log("=== MasterSuite Sync Started ===");
  console.log("Time:", new Date().toISOString());

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // Territories
  try {
    console.log("\n[1/5] Syncing territories...");
    const { syncTerritories } = require("@/lib/mastersuite/sync-territories");
    const r = await syncTerritories();
    results.territories = r;
    console.log("  Done:", JSON.stringify(r).slice(0, 150));
  } catch (err: any) {
    console.error("  FAILED:", err.message);
    errors.push(`territories: ${err.message}`);
  }

  // Properties
  try {
    console.log("\n[2/5] Syncing properties...");
    const { syncProperties } = require("@/lib/mastersuite/sync-properties");
    const r = await syncProperties();
    results.properties = r;
    console.log("  Done:", JSON.stringify(r).slice(0, 150));
  } catch (err: any) {
    console.error("  FAILED:", err.message);
    errors.push(`properties: ${err.message}`);
  }

  // EOS
  try {
    console.log("\n[3/5] Syncing EOS...");
    const { syncAllEos } = require("@/lib/mastersuite/sync-eos");
    const r = await syncAllEos();
    results.eos = r;
    console.log("  Done:", JSON.stringify(r).slice(0, 150));
  } catch (err: any) {
    console.error("  FAILED:", err.message);
    errors.push(`eos: ${err.message}`);
  }

  // Prospects
  try {
    console.log("\n[4/5] Syncing prospects...");
    const { syncPtoProspects } = require("@/lib/mastersuite/sync-pto-prospects");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const r = await syncPtoProspects(since);
    results.prospects = r;
    console.log("  Done:", JSON.stringify(r).slice(0, 150));
  } catch (err: any) {
    console.error("  FAILED:", err.message);
    errors.push(`prospects: ${err.message}`);
  }

  // Lead list counts
  try {
    console.log("\n[5/5] Syncing lead list counts...");
    const { syncLeadListCounts } = require("@/lib/mastersuite/sync-properties");
    const r = await syncLeadListCounts();
    results.leadList = r;
    console.log("  Done:", JSON.stringify(r).slice(0, 150));
  } catch (err: any) {
    console.error("  FAILED:", err.message);
    errors.push(`leadList: ${err.message}`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== Sync Complete in ${elapsed}s ===`);
  if (errors.length > 0) {
    console.error("Errors:", errors);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
