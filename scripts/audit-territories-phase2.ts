/**
 * Phase 2: Verify slug mappings, find contacts, check journeys
 * Run: npx tsx scripts/audit-territories-phase2.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { queryMS } from "../lib/mastersuite/client";
import { getServiceSupabase } from "../lib/mastersuite/supabase";

async function main() {
  const supabase = getServiceSupabase();

  // 1. Check MasterSuite for NORMI, RALNHC, and any Norfolk/Raleigh slugs
  console.log("=== MASTERSUITE SLUG CHECK ===\n");

  const norfolkRows = await queryMS<{
    TerritorySlug: string;
    Nickname: string;
    Active: number;
    PersonalName: string | null;
  }>(
    `SELECT TerritorySlug, Nickname, Active, PersonalName FROM Territories WHERE TerritorySlug LIKE '%NOR%' OR Nickname LIKE '%Norfolk%' OR Nickname LIKE '%Norf%'`
  );
  console.log("Norfolk-related in MasterSuite:");
  for (const r of norfolkRows)
    console.log(`  ${r.TerritorySlug.padEnd(15)} ${r.Nickname.padEnd(30)} Active=${r.Active} Owner=${r.PersonalName}`);

  const raleighRows = await queryMS<{
    TerritorySlug: string;
    Nickname: string;
    Active: number;
    PersonalName: string | null;
  }>(
    `SELECT TerritorySlug, Nickname, Active, PersonalName FROM Territories WHERE TerritorySlug LIKE '%RAL%' OR Nickname LIKE '%Raleigh%'`
  );
  console.log("\nRaleigh-related in MasterSuite:");
  for (const r of raleighRows)
    console.log(`  ${r.TerritorySlug.padEnd(15)} ${r.Nickname.padEnd(30)} Active=${r.Active} Owner=${r.PersonalName}`);

  const kissRows = await queryMS<{
    TerritorySlug: string;
    Nickname: string;
    Active: number;
    PersonalName: string | null;
  }>(
    `SELECT TerritorySlug, Nickname, Active, PersonalName FROM Territories WHERE TerritorySlug LIKE '%KSS%' OR TerritorySlug LIKE '%KISS%' OR Nickname LIKE '%Kissimmee%'`
  );
  console.log("\nKissimmee-related in MasterSuite:");
  for (const r of kissRows)
    console.log(`  ${r.TerritorySlug.padEnd(15)} ${r.Nickname.padEnd(30)} Active=${r.Active} Owner=${r.PersonalName}`);

  // 2. Find contacts for the 6 owners who need territory_owners records
  console.log("\n=== CONTACT LOOKUP FOR OWNERS ===\n");

  const ownerNames = [
    { name: "Jonathan Dreyer", territory: "ALCHUA" },
    { name: "Omayra Mota", territory: "KSSMEE" },
    { name: "Will Scott", territory: "MONMTH" },
    { name: "Ryan Rodriguez-Wiggins", territory: "NOWTNJ" },
    { name: "Erik Spersrud", territory: "SASOTA" },
    { name: "Jonathan Suda", territory: "WICHTA" },
  ];

  for (const { name, territory } of ownerNames) {
    const parts = name.split(" ");
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];

    // Search contacts by name
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, ghl_contact_id, contact_type")
      .or(`last_name.ilike.%${lastName}%`)
      .ilike("first_name", `%${firstName}%`)
      .limit(5);

    if (error) {
      console.log(`${territory} (${name}): ERROR - ${error.message}`);
      continue;
    }

    if (!contacts || contacts.length === 0) {
      console.log(`${territory} (${name}): NO CONTACT FOUND`);
    } else {
      for (const c of contacts) {
        console.log(
          `${territory} (${name}): id=${c.id} ghl=${c.ghl_contact_id} type=${c.contact_type} email=${c.email}`
        );
      }
    }
  }

  // 3. Check journeys for ALCHUA, NOWTNJ, WICHTA owners
  console.log("\n=== JOURNEY CHECK ===\n");

  const journeyTerritories = ["ALCHUA", "NOWTNJ", "WICHTA"];
  for (const slug of journeyTerritories) {
    const { data: journeys, error } = await supabase
      .from("journeys")
      .select("id, contact_id, TerritorySlug, current_stage, status, contacts(first_name, last_name)")
      .eq("TerritorySlug", slug);

    if (error) {
      console.log(`${slug}: journey query error - ${error.message}`);
      continue;
    }

    if (!journeys || journeys.length === 0) {
      console.log(`${slug}: NO JOURNEY FOUND`);

      // Also check if there's a journey for this contact without territory
      const ownerEntry = ownerNames.find((o) => o.territory === slug);
      if (ownerEntry) {
        const parts = ownerEntry.name.split(" ");
        const lastName = parts[parts.length - 1];
        const { data: contactJourneys } = await supabase
          .from("journeys")
          .select("id, contact_id, TerritorySlug, current_stage, status, contacts(first_name, last_name)")
          .is("TerritorySlug", null)
          .limit(50);

        // Find by contact name match
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id")
          .ilike("last_name", `%${lastName}%`)
          .limit(3);

        if (contacts && contacts.length > 0) {
          const contactIds = contacts.map((c) => c.id);
          const { data: cJourneys } = await supabase
            .from("journeys")
            .select("id, contact_id, TerritorySlug, current_stage, status")
            .in("contact_id", contactIds);

          if (cJourneys && cJourneys.length > 0) {
            for (const j of cJourneys) {
              console.log(
                `  → Found journey for contact: journey_id=${j.id} territory=${j.TerritorySlug} stage=${j.current_stage} status=${j.status}`
              );
            }
          } else {
            console.log(`  → No journey found for ${ownerEntry.name} at all`);
          }
        }
      }
    } else {
      for (const j of journeys as any[]) {
        const contactName = j.contacts ? `${j.contacts.first_name} ${j.contacts.last_name}` : "unknown";
        console.log(`${slug}: journey_id=${j.id} contact=${contactName} stage=${j.current_stage} status=${j.status}`);
      }
    }
  }

  // 4. Check existing territory_owners for KISSMEE vs KSSMEE, MONMTH, SASOTA
  console.log("\n=== EXISTING TERRITORY_OWNERS CHECK ===\n");
  const checkSlugs = ["KISSMEE", "KSSMEE", "MONMTH", "SASOTA", "NORVM", "NORMI", "RALNHC"];
  for (const slug of checkSlugs) {
    const { data: owners } = await supabase
      .from("territory_owners")
      .select("TerritorySlug, ghl_contact_id, role, start_date, end_date")
      .eq("TerritorySlug", slug);

    if (owners && owners.length > 0) {
      for (const o of owners)
        console.log(`  ${slug}: ghl=${o.ghl_contact_id} role=${o.role} start=${o.start_date} end=${o.end_date}`);
    } else {
      console.log(`  ${slug}: no owner record`);
    }
  }

  // 5. Check Supabase territory status for the slug pairs
  console.log("\n=== SUPABASE TERRITORY STATUS ===\n");
  const statusSlugs = ["KISSMEE", "KSSMEE", "NORVM", "NORMI", "RALNHC"];
  const { data: statusRows } = await supabase
    .from("territories")
    .select("TerritorySlug, Nickname, status, PersonalName")
    .in("TerritorySlug", statusSlugs);

  for (const r of (statusRows ?? []) as any[]) {
    console.log(
      `  ${r.TerritorySlug.padEnd(15)} ${(r.Nickname || "").padEnd(30)} status=${r.status} owner=${r.PersonalName}`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
