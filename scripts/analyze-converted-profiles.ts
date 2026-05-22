/**
 * Analyze converted franchisee profiles to extract common patterns.
 * Used to inform rule-based lookalike scoring weights.
 *
 * Run: source .env.local && npx tsx scripts/analyze-converted-profiles.ts
 */

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase env vars required");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: { transport: ws as any },
  });

  // ── 1. All converted contacts ──────────────────────────────────
  const { data: converted } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, opportunity_source, state, city, created_at, converted_at")
    .eq("is_converted_franchisee", true);

  console.log(`\n=== Converted Franchisee Analysis (${converted?.length ?? 0} contacts) ===\n`);

  // ── 2. Profile fields for converted contacts ───────────────────
  const ids = (converted ?? []).map((c) => c.id);

  const { data: profileFields } = await supabase
    .from("contact_profile_fields")
    .select("contact_id, field_key, field_value")
    .in("contact_id", ids);

  // Group by field_key to see which fields are most commonly filled
  const fieldFreq = new Map<string, number>();
  const fieldValues = new Map<string, Map<string, number>>();
  const fieldsByContact = new Map<string, Map<string, any>>();

  for (const row of profileFields ?? []) {
    fieldFreq.set(row.field_key, (fieldFreq.get(row.field_key) ?? 0) + 1);

    // Track value distribution for categorical fields
    const val = typeof row.field_value === "object" ? JSON.stringify(row.field_value) : String(row.field_value ?? "");
    if (!fieldValues.has(row.field_key)) fieldValues.set(row.field_key, new Map());
    const valMap = fieldValues.get(row.field_key)!;
    valMap.set(val, (valMap.get(val) ?? 0) + 1);

    // Per-contact fields
    if (!fieldsByContact.has(row.contact_id)) fieldsByContact.set(row.contact_id, new Map());
    fieldsByContact.get(row.contact_id)!.set(row.field_key, row.field_value);
  }

  // Sort by frequency
  const sortedFields = [...fieldFreq.entries()].sort((a, b) => b[1] - a[1]);

  console.log("Most common profile fields among converted franchisees:");
  for (const [key, count] of sortedFields) {
    const pct = Math.round((count / ids.length) * 100);
    console.log(`  ${key}: ${count}/${ids.length} (${pct}%)`);

    // Show value distribution for top fields (limit to 5 values)
    const valMap = fieldValues.get(key)!;
    const topVals = [...valMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (topVals.length <= 10) {
      for (const [val, vCount] of topVals) {
        const truncated = val.length > 60 ? val.slice(0, 60) + "..." : val;
        console.log(`    "${truncated}": ${vCount}`);
      }
    }
  }

  // ── 3. Candidate intelligence for converted contacts ───────────
  // candidate_intelligence uses ghl_contact_id, not uuid — need to map
  const { data: convertedWithGhl } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id")
    .eq("is_converted_franchisee", true);

  const ghlIds = (convertedWithGhl ?? []).filter((c) => c.ghl_contact_id).map((c) => c.ghl_contact_id);

  const { data: ciRows } = await supabase
    .from("candidate_intelligence")
    .select(
      "contact_id, current_score, score_financial, score_operational, score_engagement, score_momentum, funding_path, net_worth_bucket, disc_profile, urgency, prior_business_owner, construction_comfort, spouse_supportive"
    )
    .in("contact_id", ghlIds);

  console.log(`\n\nCandidate Intelligence for converted (${ciRows?.length ?? 0} matched):`);

  if (ciRows && ciRows.length > 0) {
    // Score distribution
    const scores = ciRows.filter((c) => c.current_score != null && c.current_score > 0).map((c) => c.current_score);
    if (scores.length > 0) {
      scores.sort((a: number, b: number) => a - b);
      console.log(`  Score range: ${scores[0]} - ${scores[scores.length - 1]}`);
      console.log(`  Score median: ${scores[Math.floor(scores.length / 2)]}`);
      console.log(`  Score mean: ${Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)}`);
    }

    // Funding path distribution
    const fundingPaths = new Map<string, number>();
    for (const c of ciRows) {
      const fp = c.funding_path ?? "unknown";
      fundingPaths.set(fp, (fundingPaths.get(fp) ?? 0) + 1);
    }
    console.log(`  Funding paths:`);
    for (const [fp, count] of [...fundingPaths.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${fp}: ${count}`);
    }

    // Prior business owner
    const pbo = new Map<string, number>();
    for (const c of ciRows) {
      const val = c.prior_business_owner == null ? "null" : String(c.prior_business_owner);
      pbo.set(val, (pbo.get(val) ?? 0) + 1);
    }
    console.log(`  Prior business owner:`);
    for (const [val, count] of pbo) console.log(`    ${val}: ${count}`);

    // Urgency
    const urgencies = new Map<string, number>();
    for (const c of ciRows) {
      const val = c.urgency ?? "null";
      urgencies.set(val, (urgencies.get(val) ?? 0) + 1);
    }
    console.log(`  Urgency:`);
    for (const [val, count] of urgencies) console.log(`    ${val}: ${count}`);
  }

  // ── 4. Call history for converted contacts ─────────────────────
  const { data: calls } = await supabase.from("calls").select("id, contact_id").in("contact_id", ids);

  const callsByContact = new Map<string, number>();
  for (const call of calls ?? []) {
    if (call.contact_id) {
      callsByContact.set(call.contact_id, (callsByContact.get(call.contact_id) ?? 0) + 1);
    }
  }

  const callCounts = [...callsByContact.values()].sort((a, b) => a - b);
  console.log(`\n\nCall history for converted:`);
  console.log(`  Contacts with calls: ${callsByContact.size}/${ids.length}`);
  if (callCounts.length > 0) {
    console.log(`  Call count range: ${callCounts[0]} - ${callCounts[callCounts.length - 1]}`);
    console.log(`  Call count median: ${callCounts[Math.floor(callCounts.length / 2)]}`);
    console.log(`  Call count mean: ${(callCounts.reduce((a, b) => a + b, 0) / callCounts.length).toFixed(1)}`);
  }

  // ── 5. Opportunity source distribution ─────────────────────────
  const sources = new Map<string, number>();
  for (const c of converted ?? []) {
    const s = c.opportunity_source ?? "null";
    sources.set(s, (sources.get(s) ?? 0) + 1);
  }
  console.log(`\n\nOpportunity source:`);
  for (const [src, count] of [...sources.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${count}`);
  }

  // ── 6. State distribution ──────────────────────────────────────
  const states = new Map<string, number>();
  for (const c of converted ?? []) {
    const s = c.state ?? "null";
    states.set(s, (states.get(s) ?? 0) + 1);
  }
  console.log(`\n\nState distribution:`);
  for (const [st, count] of [...states.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${st}: ${count}`);
  }

  // ── 7. Lead scores for converted contacts ──────────────────────
  const { data: leadScoreFields } = await supabase
    .from("contact_profile_fields")
    .select("contact_id, field_value")
    .in("contact_id", ids)
    .eq("field_key", "scout_lead_score");

  const leadScores = (leadScoreFields ?? [])
    .map((f) =>
      typeof f.field_value === "number"
        ? f.field_value
        : typeof f.field_value === "object" && f.field_value?.score
          ? f.field_value.score
          : null
    )
    .filter((s): s is number => s != null)
    .sort((a, b) => a - b);

  console.log(`\n\nLead scores for converted:`);
  console.log(`  With score: ${leadScores.length}/${ids.length}`);
  if (leadScores.length > 0) {
    console.log(`  Range: ${leadScores[0]} - ${leadScores[leadScores.length - 1]}`);
    console.log(`  Median: ${leadScores[Math.floor(leadScores.length / 2)]}`);
    console.log(`  Mean: ${Math.round(leadScores.reduce((a, b) => a + b, 0) / leadScores.length)}`);
  }

  // ── 8. Commitments for converted contacts ──────────────────────
  const { data: commitments } = await supabase.from("commitments").select("contact_id, status").in("contact_id", ids);

  const commitsByContact = new Map<string, number>();
  const fulfilledByContact = new Map<string, number>();
  for (const cm of commitments ?? []) {
    if (cm.contact_id) {
      commitsByContact.set(cm.contact_id, (commitsByContact.get(cm.contact_id) ?? 0) + 1);
      if (cm.status === "fulfilled") {
        fulfilledByContact.set(cm.contact_id, (fulfilledByContact.get(cm.contact_id) ?? 0) + 1);
      }
    }
  }

  console.log(`\n\nCommitments for converted:`);
  console.log(`  Contacts with commitments: ${commitsByContact.size}/${ids.length}`);
  const commitCounts = [...commitsByContact.values()].sort((a, b) => a - b);
  if (commitCounts.length > 0) {
    console.log(`  Commitment count range: ${commitCounts[0]} - ${commitCounts[commitCounts.length - 1]}`);
    console.log(
      `  Commitment count mean: ${(commitCounts.reduce((a, b) => a + b, 0) / commitCounts.length).toFixed(1)}`
    );
  }

  // ── 9. Time-to-convert distribution ────────────────────────────
  const ttc: number[] = [];
  for (const c of converted ?? []) {
    if (c.created_at && c.converted_at) {
      const days = Math.round(
        (new Date(c.converted_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days >= 0) ttc.push(days);
    }
  }
  ttc.sort((a, b) => a - b);
  console.log(`\n\nTime-to-convert (days from contact created to converted):`);
  console.log(`  With both dates: ${ttc.length}/${ids.length}`);
  if (ttc.length > 0) {
    console.log(`  Range: ${ttc[0]} - ${ttc[ttc.length - 1]} days`);
    console.log(`  Median: ${ttc[Math.floor(ttc.length / 2)]} days`);
    console.log(`  Mean: ${Math.round(ttc.reduce((a, b) => a + b, 0) / ttc.length)} days`);
  }
}

main().catch(console.error);
