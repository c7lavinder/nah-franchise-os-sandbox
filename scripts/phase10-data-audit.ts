/**
 * Phase 10 — Pre-flight Data Audit (GATE)
 *
 * Checks whether we have enough data for predictive lookalike models:
 *   1. Converted contacts with profile data (need >= 30)
 *   2. Lost contacts with profile data (need >= 30)
 *   3. Franchisees with T12 metrics per tier (need >= 10 each)
 *
 * Run: source .env.local && npx tsx scripts/phase10-data-audit.ts
 */

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase env vars required");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: { transport: ws as any },
  });

  console.log("=== Phase 10 Pre-flight Data Audit ===\n");

  // ── GATE 1: Converted contacts ──────────────────────────────────
  // Two sources: contacts.is_converted_franchisee and journeys closed with 'won'
  const { data: convertedContacts, error: e1 } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, is_converted_franchisee, converted_at")
    .eq("is_converted_franchisee", true);

  if (e1) console.error("Error fetching converted contacts:", e1.message);
  const convertedCount = convertedContacts?.length ?? 0;

  // Check how many converted contacts have profile fields
  let convertedWithProfile = 0;
  let convertedProfileCounts: { name: string; fieldCount: number }[] = [];
  if (convertedContacts && convertedContacts.length > 0) {
    const convertedIds = convertedContacts.map((c) => c.id);
    // Count profile fields per converted contact
    const { data: profileCounts, error: e1p } = await supabase
      .from("contact_profile_fields")
      .select("contact_id")
      .in("contact_id", convertedIds);

    if (e1p) console.error("Error fetching profile fields:", e1p.message);

    const fieldsByContact = new Map<string, number>();
    for (const row of profileCounts ?? []) {
      fieldsByContact.set(row.contact_id, (fieldsByContact.get(row.contact_id) ?? 0) + 1);
    }

    for (const c of convertedContacts) {
      const count = fieldsByContact.get(c.id) ?? 0;
      convertedProfileCounts.push({
        name: `${c.first_name} ${c.last_name}`,
        fieldCount: count,
      });
      if (count >= 5) convertedWithProfile++;
    }

    convertedProfileCounts.sort((a, b) => b.fieldCount - a.fieldCount);
  }

  console.log(`GATE 1: Converted Contacts (need >= 30)`);
  console.log(`  Total converted: ${convertedCount}`);
  console.log(`  With >= 5 profile fields: ${convertedWithProfile}`);
  console.log(`  PASS: ${convertedWithProfile >= 30 ? "YES" : "NO"}`);
  if (convertedProfileCounts.length > 0) {
    console.log(`  Top 10 by profile completeness:`);
    for (const c of convertedProfileCounts.slice(0, 10)) {
      console.log(`    - ${c.name}: ${c.fieldCount} fields`);
    }
    console.log(`  Bottom 5:`);
    for (const c of convertedProfileCounts.slice(-5)) {
      console.log(`    - ${c.name}: ${c.fieldCount} fields`);
    }
  }
  console.log();

  // ── GATE 2: Lost contacts ───────────────────────────────────────
  // Journeys closed with reason != 'won'
  const { data: closedJourneys, error: e2 } = await supabase
    .from("journeys")
    .select("id, name, status, close_reason, primary_contact_id")
    .eq("status", "closed");

  if (e2) console.error("Error fetching closed journeys:", e2.message);

  const wonJourneys = (closedJourneys ?? []).filter((j) => j.close_reason === "won");
  const lostJourneys = (closedJourneys ?? []).filter((j) => j.close_reason !== "won");

  // Also check: contacts NOT converted AND not in any active journey (stale leads)
  const { count: totalContacts } = await supabase.from("contacts").select("id", { count: "exact", head: true });

  const { count: activeJourneyContacts } = await supabase
    .from("journeys")
    .select("primary_contact_id", { count: "exact", head: true })
    .eq("status", "active");

  // Lost = closed journeys with non-won reason
  const lostContactIds = lostJourneys.map((j) => j.primary_contact_id);
  let lostWithProfile = 0;
  let lostProfileCounts: { name: string; reason: string; fieldCount: number }[] = [];

  if (lostContactIds.length > 0) {
    const { data: lostContacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .in("id", lostContactIds);

    const { data: lostFields } = await supabase
      .from("contact_profile_fields")
      .select("contact_id")
      .in("contact_id", lostContactIds);

    const fieldsByContact = new Map<string, number>();
    for (const row of lostFields ?? []) {
      fieldsByContact.set(row.contact_id, (fieldsByContact.get(row.contact_id) ?? 0) + 1);
    }

    const contactNameMap = new Map((lostContacts ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`]));

    for (const j of lostJourneys) {
      const count = fieldsByContact.get(j.primary_contact_id) ?? 0;
      lostProfileCounts.push({
        name: contactNameMap.get(j.primary_contact_id) ?? j.name,
        reason: j.close_reason ?? "null",
        fieldCount: count,
      });
      if (count >= 5) lostWithProfile++;
    }

    lostProfileCounts.sort((a, b) => b.fieldCount - a.fieldCount);
  }

  // Also count non-converted contacts not in any journey (potential "lost" pool)
  const { data: noJourneyContacts, error: e2b } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, is_converted_franchisee")
    .eq("is_converted_franchisee", false);

  let noJourneyLost = 0;
  if (noJourneyContacts) {
    const { data: activeJourneyPrimaries } = await supabase
      .from("journeys")
      .select("primary_contact_id")
      .eq("status", "active");
    const activeIds = new Set((activeJourneyPrimaries ?? []).map((j) => j.primary_contact_id));
    noJourneyLost = noJourneyContacts.filter((c) => !activeIds.has(c.id)).length;
  }

  console.log(`GATE 2: Lost Contacts (need >= 30)`);
  console.log(`  Total contacts: ${totalContacts}`);
  console.log(`  Closed journeys (won): ${wonJourneys.length}`);
  console.log(`  Closed journeys (lost/dropped): ${lostJourneys.length}`);
  console.log(`  Lost with >= 5 profile fields: ${lostWithProfile}`);
  console.log(`  Non-converted, no active journey (potential lost pool): ${noJourneyLost}`);
  console.log(`  Close reasons breakdown:`);
  const reasonCounts = new Map<string, number>();
  for (const j of lostJourneys) {
    const r = j.close_reason ?? "null";
    reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
  }
  for (const [reason, count] of reasonCounts) {
    console.log(`    - ${reason}: ${count}`);
  }
  console.log(`  PASS: ${lostWithProfile >= 30 ? "YES" : "NO"}`);
  if (lostProfileCounts.length > 0) {
    console.log(`  Top 10 by profile completeness:`);
    for (const c of lostProfileCounts.slice(0, 10)) {
      console.log(`    - ${c.name} (${c.reason}): ${c.fieldCount} fields`);
    }
  }
  console.log();

  // ── GATE 3: T12 metrics per tier ────────────────────────────────
  const { data: perfRows, error: e3 } = await supabase.from("franchisee_performance").select("*");

  if (e3) console.error("Error fetching franchisee_performance:", e3.message);

  const perfData = perfRows ?? [];
  const withRevenue = perfData.filter((p) => p.revenue_year1 != null);
  const withHouses = perfData.filter((p) => p.houses_purchased_year1 != null || p.houses_purchased_total != null);

  // Tier by houses_purchased_total (proxy for performance)
  const withTotal = perfData.filter((p) => p.houses_purchased_total != null && p.houses_purchased_total > 0);
  withTotal.sort((a, b) => (b.houses_purchased_total ?? 0) - (a.houses_purchased_total ?? 0));

  let topTier = 0,
    midTier = 0,
    lowTier = 0;
  if (withTotal.length > 0) {
    const p80 = withTotal[Math.floor(withTotal.length * 0.2)]?.houses_purchased_total ?? 0;
    const p50 = withTotal[Math.floor(withTotal.length * 0.5)]?.houses_purchased_total ?? 0;

    for (const p of withTotal) {
      const total = p.houses_purchased_total ?? 0;
      if (total >= p80) topTier++;
      else if (total >= p50) midTier++;
      else lowTier++;
    }

    console.log(`GATE 3: T12 Metrics Per Tier (need >= 10 each)`);
    console.log(`  Total franchisee_performance rows: ${perfData.length}`);
    console.log(`  With revenue_year1: ${withRevenue.length}`);
    console.log(`  With houses data: ${withHouses.length}`);
    console.log(`  With houses_purchased_total > 0: ${withTotal.length}`);
    console.log(`  Tier thresholds: top >= ${p80} houses, mid >= ${p50}, low < ${p50}`);
    console.log(`  Top tier: ${topTier}`);
    console.log(`  Mid tier: ${midTier}`);
    console.log(`  Low tier: ${lowTier}`);
    console.log(`  PASS: ${topTier >= 10 && midTier >= 10 && lowTier >= 10 ? "YES" : "NO"}`);
  } else {
    console.log(`GATE 3: T12 Metrics Per Tier (need >= 10 each)`);
    console.log(`  Total franchisee_performance rows: ${perfData.length}`);
    console.log(`  With revenue_year1: ${withRevenue.length}`);
    console.log(`  With houses data: ${withHouses.length}`);
    console.log(`  No houses_purchased_total data — PASS: NO`);
  }

  // Active status breakdown
  const statusCounts = new Map<string, number>();
  for (const p of perfData) {
    const s = p.active_status ?? "null";
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
  }
  if (statusCounts.size > 0) {
    console.log(`  Active status breakdown:`);
    for (const [status, count] of statusCounts) {
      console.log(`    - ${status}: ${count}`);
    }
  }
  console.log();

  // ── BONUS: candidate_intelligence completeness ──────────────────
  const { data: ciRows, error: e4 } = await supabase
    .from("candidate_intelligence")
    .select(
      "contact_id, current_score, score_financial, score_operational, score_engagement, score_momentum, disc_profile, net_worth_bucket, funding_path, zorakle_completed, urgency"
    );

  if (e4) console.error("Error fetching candidate_intelligence:", e4.message);

  const ciData = ciRows ?? [];
  const withScore = ciData.filter((c) => c.current_score != null && c.current_score > 0);
  const withDisc = ciData.filter((c) => c.disc_profile != null);
  const withZorakle = ciData.filter((c) => c.zorakle_completed === true);
  const withFunding = ciData.filter((c) => c.funding_path != null);
  const withNetWorth = ciData.filter((c) => c.net_worth_bucket != null);

  console.log(`BONUS: Candidate Intelligence Completeness`);
  console.log(`  Total rows: ${ciData.length}`);
  console.log(`  With score > 0: ${withScore.length}`);
  console.log(`  With DISC profile: ${withDisc.length}`);
  console.log(`  With Zorakle: ${withZorakle.length}`);
  console.log(`  With funding_path: ${withFunding.length}`);
  console.log(`  With net_worth_bucket: ${withNetWorth.length}`);
  console.log();

  // ── SUMMARY ─────────────────────────────────────────────────────
  const gate1 = convertedWithProfile >= 30;
  const gate2 = lostWithProfile >= 30;
  const gate3 = topTier >= 10 && midTier >= 10 && lowTier >= 10;

  console.log("=== GATE SUMMARY ===");
  console.log(`Gate 1 (Converted >= 30 w/ profile): ${gate1 ? "PASS" : "FAIL"} (${convertedWithProfile})`);
  console.log(`Gate 2 (Lost >= 30 w/ profile):      ${gate2 ? "PASS" : "FAIL"} (${lostWithProfile})`);
  console.log(`Gate 3 (T12 >= 10 per tier):         ${gate3 ? "PASS" : "FAIL"} (${topTier}/${midTier}/${lowTier})`);
  console.log();

  if (gate1 && gate2 && gate3) {
    console.log("ALL GATES PASS — proceed with predictive lookalike models.");
  } else {
    console.log("ONE OR MORE GATES FAILED — pivot to rule-based scoring.");
    if (!gate1) console.log("  -> Need more converted contacts with profile data.");
    if (!gate2) console.log("  -> Need more lost contacts with profile data, or expand definition of 'lost'.");
    if (!gate3) console.log("  -> Need more T12 performance data. Consider MasterSuite property sync.");
  }
}

main().catch(console.error);
