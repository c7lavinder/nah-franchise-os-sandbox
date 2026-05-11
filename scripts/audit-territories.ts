/**
 * Audit script: compare MasterSuite Territories vs Supabase territories
 * Run: npx tsx scripts/audit-territories.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { queryMS } from "../lib/mastersuite/client";
import { getServiceSupabase } from "../lib/mastersuite/supabase";

interface MSTerr {
  TerritoryId: number;
  TerritorySlug: string;
  Nickname: string;
  Active: number;
  FranchiseClosedDate: string | null;
  PersonalName: string | null;
  Owner2: string | null;
  Owner3: string | null;
  FranchiseEmail: string | null;
  PersonalPhoneNumber: string | null;
  PrimaryCoach: string | null;
  NahState: string | null;
}

interface SupaTerr {
  TerritorySlug: string;
  Nickname: string;
  status: string;
  PersonalName: string | null;
  Owner2: string | null;
  Owner3: string | null;
  FranchiseEmail: string | null;
  PersonalPhoneNumber: string | null;
  PrimaryCoach: string | null;
  NahState: string | null;
  ms_synced_at: string | null;
}

async function main() {
  const supabase = getServiceSupabase();

  // 1. Get all MasterSuite territories
  const msRows = await queryMS<MSTerr>(
    `SELECT TerritoryId, TerritorySlug, Nickname, Active, FranchiseClosedDate,
            PersonalName, Owner2, Owner3, FranchiseEmail, PersonalPhoneNumber,
            PrimaryCoach, NahState
     FROM Territories ORDER BY TerritorySlug`
  );

  // 2. Get all Supabase territories
  const { data: supaRows, error } = await supabase
    .from("territories")
    .select(
      "TerritorySlug, Nickname, status, PersonalName, Owner2, Owner3, FranchiseEmail, PersonalPhoneNumber, PrimaryCoach, NahState, ms_synced_at"
    )
    .order("TerritorySlug");

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  const supaMap = new Map((supaRows as SupaTerr[]).map((r) => [r.TerritorySlug, r]));
  const msMap = new Map(msRows.map((r) => [r.TerritorySlug, r]));

  console.log(`\n=== TERRITORY AUDIT ===`);
  console.log(`MasterSuite: ${msRows.length} territories`);
  console.log(`Supabase:    ${supaRows?.length ?? 0} territories\n`);

  // 3. In MasterSuite but NOT in Supabase
  const missingInSupabase: MSTerr[] = [];
  for (const ms of msRows) {
    if (!supaMap.has(ms.TerritorySlug)) {
      missingInSupabase.push(ms);
    }
  }

  if (missingInSupabase.length > 0) {
    console.log(`--- MISSING IN SUPABASE (${missingInSupabase.length}) ---`);
    for (const t of missingInSupabase) {
      const status = t.FranchiseClosedDate ? "CLOSED" : t.Active ? "ACTIVE" : "INACTIVE";
      console.log(
        `  ${t.TerritorySlug.padEnd(30)} ${t.Nickname.padEnd(30)} [${status}] Owner: ${t.PersonalName || "N/A"}`
      );
    }
    console.log();
  }

  // 4. In Supabase but NOT in MasterSuite
  const missingInMS: SupaTerr[] = [];
  for (const [slug, supa] of supaMap) {
    if (!msMap.has(slug)) {
      missingInMS.push(supa);
    }
  }

  if (missingInMS.length > 0) {
    console.log(`--- IN SUPABASE BUT NOT IN MASTERSUITE (${missingInMS.length}) ---`);
    for (const t of missingInMS) {
      console.log(`  ${t.TerritorySlug.padEnd(30)} ${t.Nickname.padEnd(30)} [${t.status}]`);
    }
    console.log();
  }

  // 5. Slug match but data mismatch (owner info, nickname, status)
  const ownerMismatches: { slug: string; field: string; ms: string | null; supa: string | null }[] = [];
  const nicknameMismatches: { slug: string; ms: string; supa: string }[] = [];

  for (const ms of msRows) {
    const supa = supaMap.get(ms.TerritorySlug);
    if (!supa) continue;

    // Check nickname
    if (ms.Nickname !== supa.Nickname) {
      nicknameMismatches.push({ slug: ms.TerritorySlug, ms: ms.Nickname, supa: supa.Nickname });
    }

    // Check owner fields
    const fields: (keyof MSTerr & keyof SupaTerr)[] = [
      "PersonalName",
      "Owner2",
      "Owner3",
      "FranchiseEmail",
      "PersonalPhoneNumber",
      "PrimaryCoach",
      "NahState",
    ];
    for (const f of fields) {
      const msVal = ms[f] as string | null;
      const supaVal = supa[f] as string | null;
      // Normalize: treat empty string as null
      const msNorm = msVal?.trim() || null;
      const supaNorm = supaVal?.trim() || null;
      if (msNorm !== supaNorm) {
        ownerMismatches.push({ slug: ms.TerritorySlug, field: f, ms: msNorm, supa: supaNorm });
      }
    }
  }

  if (nicknameMismatches.length > 0) {
    console.log(`--- NICKNAME MISMATCHES (${nicknameMismatches.length}) ---`);
    for (const m of nicknameMismatches) {
      console.log(`  ${m.slug.padEnd(30)} MS: "${m.ms}"  →  Supa: "${m.supa}"`);
    }
    console.log();
  }

  if (ownerMismatches.length > 0) {
    console.log(`--- OWNER/INFO MISMATCHES (${ownerMismatches.length}) ---`);
    for (const m of ownerMismatches) {
      console.log(
        `  ${m.slug.padEnd(30)} ${m.field.padEnd(25)} MS: "${m.ms ?? "(null)"}"  →  Supa: "${m.supa ?? "(null)"}"`
      );
    }
    console.log();
  }

  // 6. Supabase territories never synced
  const neverSynced = (supaRows as SupaTerr[]).filter((r) => !r.ms_synced_at && msMap.has(r.TerritorySlug));
  if (neverSynced.length > 0) {
    console.log(`--- NEVER SYNCED (in both but ms_synced_at is null) (${neverSynced.length}) ---`);
    for (const t of neverSynced) {
      console.log(`  ${t.TerritorySlug.padEnd(30)} ${t.Nickname}`);
    }
    console.log();
  }

  // 7. Territory owners table check
  const { data: owners, error: oErr } = await supabase
    .from("territory_owners")
    .select("TerritorySlug, ghl_contact_id, role, start_date, end_date")
    .order("TerritorySlug");

  if (oErr) {
    console.error("territory_owners error:", oErr.message);
  } else {
    const ownerSlugs = new Set((owners ?? []).map((o: { TerritorySlug: string }) => o.TerritorySlug));
    const activeSupaTerritories = (supaRows as SupaTerr[]).filter((r) => r.status === "active");
    const noOwnerRecord = activeSupaTerritories.filter((t) => !ownerSlugs.has(t.TerritorySlug));

    if (noOwnerRecord.length > 0) {
      console.log(`--- ACTIVE TERRITORIES WITH NO OWNER RECORD (${noOwnerRecord.length}) ---`);
      for (const t of noOwnerRecord) {
        console.log(
          `  ${t.TerritorySlug.padEnd(30)} ${t.Nickname.padEnd(30)} PersonalName: ${t.PersonalName || "N/A"}`
        );
      }
      console.log();
    }
    console.log(`Territory owners table: ${owners?.length ?? 0} records across ${ownerSlugs.size} territories`);
  }

  // Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`Missing in Supabase:    ${missingInSupabase.length}`);
  console.log(`Extra in Supabase:      ${missingInMS.length}`);
  console.log(`Nickname mismatches:    ${nicknameMismatches.length}`);
  console.log(`Owner/info mismatches:  ${ownerMismatches.length}`);
  console.log(`Never synced:           ${neverSynced.length}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
