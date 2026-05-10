import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { syncTerritories } from "../lib/mastersuite/sync-territories";
import { syncProperties, syncLeadListCounts } from "../lib/mastersuite/sync-properties";

// Override the supabase client in sync modules to disable realtime
process.env.SUPABASE_DISABLE_REALTIME = "true";

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || "territories";

  console.log(`\n=== MasterSuite Sync: ${target} ===\n`);

  if (target === "territories" || target === "all") {
    console.log("Syncing territories...");
    const result = await syncTerritories();
    console.log(`  Synced: ${result.synced}`);
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.log(`    - ${e}`));
    }
  }

  if (target === "properties" || target === "all") {
    console.log("\nSyncing properties...");
    const result = await syncProperties();
    console.log(`  Properties: ${result.synced.properties}`);
    console.log(`  Calculations: ${result.synced.calculations}`);
    console.log(`  Inventory: ${result.synced.inventory}`);
    console.log(`  Status History: ${result.synced.statusHistory}`);
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length}`);
      result.errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`));
    }
  }

  if (target === "lead-list" || target === "all") {
    console.log("\nSyncing lead list counts...");
    const result = await syncLeadListCounts();
    console.log(`  Synced: ${result.synced}`);
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e.message || e);
  process.exit(1);
});
