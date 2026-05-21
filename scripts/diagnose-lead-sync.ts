/**
 * Diagnose why a lead didn't sync from MasterSuite → Supabase.
 *
 * Usage: npx tsx scripts/diagnose-lead-sync.ts "Mauricio Anaya"
 *   or:  npx tsx scripts/diagnose-lead-sync.ts "mauricio" "anaya"
 */

const { register } = require("tsconfig-paths");
const { resolve } = require("path");
const tsconfig = require(resolve(__dirname, "../tsconfig.json"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

import { queryMS } from "@/lib/mastersuite/client";
import { getMasterSuitePool } from "@/lib/mastersuite/client";
// Use raw fetch against Supabase REST API to avoid WebSocket issues on Node 20
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY!;

async function sbQuery(table: string, params: string): Promise<any[]> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

const SPAM_EMAIL_PATTERNS = [/do-not-respond/i, /serviseantilogin/i, /mailbox\.in\.ua/i, /^test@/i];

function isSpamName(first: string, last: string): boolean {
  const name = `${first} ${last}`;
  if (/^(Alice|John|MyName|Hello)\s+(Alice|John|MyName|Hello)$/i.test(name)) return true;
  if (/^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(first)) return true;
  if (/^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(last)) return true;
  for (const part of [first, last]) {
    if (part.length < 6) continue;
    const upperCount = (part.match(/[A-Z]/g) || []).length;
    const lowerCount = (part.match(/[a-z]/g) || []).length;
    if (upperCount >= 3 && lowerCount >= 3) return true;
    if (part.length > 8 && /[a-z][A-Z]/.test(part) && upperCount >= 2) return true;
  }
  if (/iphone|claim free/i.test(first + last)) return true;
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  let searchFirst: string;
  let searchLast: string;

  if (args.length === 1) {
    const parts = args[0].split(/\s+/);
    searchFirst = parts[0];
    searchLast = parts.slice(1).join(" ");
  } else if (args.length >= 2) {
    searchFirst = args[0];
    searchLast = args.slice(1).join(" ");
  } else {
    console.error('Usage: npx tsx scripts/diagnose-lead-sync.ts "FirstName LastName"');
    process.exit(1);
  }

  console.log(`\n=== Diagnosing Lead Sync for: ${searchFirst} ${searchLast} ===\n`);

  // --- Step 1: Check MasterSuite ---
  console.log("--- 1. MasterSuite (PathToOwnershipEntries) ---");
  let msRows: Record<string, unknown>[] = [];
  try {
    msRows = await queryMS<Record<string, unknown>>(
      `SELECT Id, Inserted, FirstName, LastName, EmailAddress, PhoneNumber, LeadSource
       FROM PathToOwnershipEntries
       WHERE FirstName LIKE ? AND LastName LIKE ?
       ORDER BY Inserted DESC
       LIMIT 10`,
      [`%${searchFirst}%`, `%${searchLast}%`]
    );

    if (msRows.length === 0) {
      console.log("  NOT FOUND in MasterSuite. This lead was never submitted via PTO form.");
      console.log("  -> They may have come through a different channel (website, referral, manual).");
    } else {
      for (const r of msRows) {
        console.log(
          `  Found: Id=${r.Id}, Inserted=${r.Inserted}, Email=${r.EmailAddress}, Phone=${r.PhoneNumber}, Source=${r.LeadSource}`
        );

        // Check spam filters
        const first = String(r.FirstName || "");
        const last = String(r.LastName || "");
        const email = String(r.EmailAddress || "")
          .toLowerCase()
          .trim();

        if (isSpamName(first, last)) {
          console.log("  ** BLOCKED by spam name filter **");
        }
        if (SPAM_EMAIL_PATTERNS.some((p) => p.test(email))) {
          console.log("  ** BLOCKED by spam email filter **");
        }
        if (/test/i.test(first) || /test/i.test(last)) {
          console.log("  ** BLOCKED by test name filter (SQL WHERE clause) **");
        }
        if (
          !email ||
          email.length <= 5 ||
          !email.includes("@") ||
          email.includes("@test") ||
          email.endsWith("newagainhouses.com")
        ) {
          console.log("  ** BLOCKED by email validation filter **");
        }

        // Check 7-day window
        const inserted = new Date(String(r.Inserted));
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (inserted < sevenDaysAgo) {
          console.log(
            `  ** OUTSIDE 7-day lookback window ** (Inserted: ${inserted.toISOString()}, cutoff: ${sevenDaysAgo.toISOString()})`
          );
        } else {
          console.log(`  Within 7-day window (Inserted: ${inserted.toISOString()})`);
        }
      }
    }
  } catch (msErr: any) {
    console.log(`  Could not connect to MasterSuite: ${msErr.code || msErr.message}`);
    console.log("  (This is expected locally — MasterSuite DB is only reachable from production)");
  }

  // --- Step 2: Check Supabase ---
  console.log("\n--- 2. Supabase (contacts table) ---");

  const sbContacts = await sbQuery(
    "contacts",
    `select=id,first_name,last_name,email,phone,source,created_at,ghl_contact_id&or=(first_name.ilike.%25${searchFirst}%25,last_name.ilike.%25${searchLast}%25)&order=created_at.desc&limit=10`
  );

  if (!sbContacts || sbContacts.length === 0) {
    console.log("  NOT FOUND in Supabase. Contact was never created (auto or manual).");
  } else {
    for (const c of sbContacts) {
      const name = `${c.first_name} ${c.last_name}`;
      if (
        !name.toLowerCase().includes(searchFirst.toLowerCase()) ||
        !name.toLowerCase().includes(searchLast.toLowerCase())
      )
        continue;
      console.log(`  Found: id=${c.id}, name=${c.first_name} ${c.last_name}, email=${c.email}, phone=${c.phone}`);
      console.log(`         source=${c.source}, created=${c.created_at}, ghl_id=${c.ghl_contact_id}`);

      // Check journey
      const journeys = await sbQuery("journeys", `select=id,name,status,created_at&primary_contact_id=eq.${c.id}`);

      if (!journeys || journeys.length === 0) {
        console.log("         NO JOURNEY — contact exists but has no pipeline placement (won't show in pipeline view)");
      } else {
        for (const j of journeys) {
          console.log(`         Journey: ${j.name} (${j.status}), created=${j.created_at}`);
          const jps = await sbQuery(
            "journey_pipeline_state",
            `select=pipeline_id,current_stage_id,is_active&journey_id=eq.${j.id}`
          );
          if (jps && jps.length > 0) {
            for (const s of jps) {
              console.log(
                `           Pipeline state: pipeline=${s.pipeline_id}, stage=${s.current_stage_id}, active=${s.is_active}`
              );
            }
          } else {
            console.log("           NO PIPELINE STATE — journey exists but not placed in any pipeline");
          }
        }
      }
    }
  }

  // --- Step 3: Check recent cron logs ---
  console.log("\n--- 3. Recent cron logs (sync-ms-prospects) ---");
  const cronLogs = await sbQuery(
    "cron_job_log",
    `select=id,job_name,status,result,error,created_at,finished_at&job_name=eq.sync-ms-prospects&order=created_at.desc&limit=5`
  );

  if (!cronLogs || cronLogs.length === 0) {
    console.log("  NO CRON LOGS FOUND — the sync-ms-prospects cron may not be running at all!");
  } else {
    for (const log of cronLogs) {
      const result = log.result as any;
      console.log(`  ${log.created_at} → ${log.status}${log.finished_at ? ` (finished: ${log.finished_at})` : ""}`);
      if (result) {
        console.log(
          `    created=${result.created}, wired=${result.wired}, skipped=${result.skipped}, errors=${(result.errors || []).length}`
        );
        if (result.errors?.length > 0) {
          for (const e of result.errors.slice(0, 3)) console.log(`    ERROR: ${e}`);
        }
      }
      if (log.error) console.log(`    Error: ${log.error}`);
    }
  }

  // --- Step 4: Show last 10 MasterSuite PTO entries for context ---
  console.log("\n--- 4. Last 10 MasterSuite PTO entries (most recent) ---");
  try {
    const recentPto = await queryMS<Record<string, unknown>>(
      `SELECT Id, Inserted, FirstName, LastName, EmailAddress, PhoneNumber
       FROM PathToOwnershipEntries
       ORDER BY Inserted DESC
       LIMIT 10`
    );
    for (const r of recentPto) {
      const first = String(r.FirstName || "");
      const last = String(r.LastName || "");
      const email = String(r.EmailAddress || "")
        .toLowerCase()
        .trim();
      let flags = "";
      if (isSpamName(first, last)) flags += " [SPAM-NAME]";
      if (SPAM_EMAIL_PATTERNS.some((p) => p.test(email))) flags += " [SPAM-EMAIL]";
      if (/test/i.test(first) || /test/i.test(last)) flags += " [TEST-NAME]";
      if (!email || email.length <= 5 || !email.includes("@")) flags += " [BAD-EMAIL]";
      console.log(`  ${r.Inserted} | ${first} ${last} | ${email} | ${r.PhoneNumber}${flags}`);
    }
  } catch {
    console.log("  Skipped (MasterSuite not reachable)");
  }

  // --- Step 5: Show last 10 Supabase contacts with source=pto ---
  console.log("\n--- 5. Last 10 Supabase contacts with source='pto' ---");
  const recentPtoContacts = await sbQuery(
    "contacts",
    `select=id,first_name,last_name,email,created_at,source&source=eq.pto&order=created_at.desc&limit=10`
  );

  if (recentPtoContacts && recentPtoContacts.length > 0) {
    for (const c of recentPtoContacts) {
      console.log(`  ${c.created_at} | ${c.first_name} ${c.last_name} | ${c.email}`);
    }
  } else {
    console.log("  No contacts with source='pto' found.");
  }

  // Cleanup
  try {
    await getMasterSuitePool().end();
  } catch {}
  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
